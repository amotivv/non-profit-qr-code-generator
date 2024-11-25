import { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { Download, Link, Heart, Info, Edit2, Check, Wand2, AlertCircle } from 'lucide-react';
import OpenAI from 'openai';
import LogoUpload from './LogoUpload';
import UserForm from './UserForm';
import { saveUser, saveQRCode, User } from '../lib/supabase';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : null;

const QRCodeGenerator = () => {
  const [url, setUrl] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [urlPurpose, setUrlPurpose] = useState('');
  const [qrColor, setQrColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState(256);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingPurpose, setEditingPurpose] = useState(false);
  const [tempDescription, setTempDescription] = useState('');
  const [tempPurpose, setTempPurpose] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const qrRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLDivElement>(null);


  const handleUserSubmit = async (userData: Omit<User, 'id' | 'created_at'>) => {
    setIsSubmitting(true);
    setError('');
    try {
      const savedUser = await saveUser(userData);
      setUser(savedUser);
    } catch (err: any) {
      setError(err.message || 'Error saving user data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateAIText = async (type: 'description' | 'purpose') => {
    if (isGenerating) return;
    
    if (!openai) {
      setError('OpenAI API key is not configured. Please add your API key to the environment variables.');
      return;
    }

    setError('');
    setIsGenerating(true);
    try {
      const prompt = type === 'description'
        ? `Write a concise, engaging description for a non-profit organization based on this context: ${orgDescription}. Make it professional and appealing to potential donors or supporters. Keep it under 100 words.`
        : `Write a clear, compelling explanation of this URL's purpose based on this context: ${urlPurpose}. The URL is: ${url}. Focus on the value it provides to visitors. Keep it under 75 words.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional copywriter specializing in non-profit communications."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const generatedText = response.choices[0]?.message?.content?.trim() || '';
      
      if (type === 'description') {
        setOrgDescription(generatedText);
      } else {
        setUrlPurpose(generatedText);
      }
    } catch (error: any) {
      setError(error?.error?.message || 'Error generating AI text. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };


  const downloadImage = async (format: 'png' | 'jpg' | 'pdf') => {
    if (!downloadRef.current || !user?.id) return;

    try {
      console.log('Starting QR code save...', {
        user_id: user.id,
        url,
        org_description: orgDescription,
        url_purpose: urlPurpose,
        qr_color: qrColor,
        bg_color: bgColor,
        size,
        has_logo: !!logo
      });
  
      // First save the QR code
      const savedQR = await saveQRCode({
        user_id: user.id,
        url,
        org_description: orgDescription,
        url_purpose: urlPurpose,
        qr_color: qrColor,
        bg_color: bgColor,
        size,
        has_logo: !!logo
      });
  
      console.log('QR code saved successfully:', savedQR);

      if (format === 'pdf') {
        const dataUrl = await toPng(downloadRef.current, { quality: 1.0 });
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'in',
          format: 'letter' // 8.5 x 11 inches
        });
        
        const imgProps = pdf.getImageProperties(dataUrl);
        const pageWidth = 8.5;
        const pageHeight = 11;
        const margin = 0.5; // 0.5 inch margins
        const maxWidth = pageWidth - (2 * margin);
        const maxHeight = pageHeight - (2 * margin);
        
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = imgProps.width / imgProps.height;
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
        
        // Center the image on the page
        const x = (pageWidth - width) / 2;
        const y = (pageHeight - height) / 2;
        
        pdf.addImage(dataUrl, 'PNG', x, y, width, height);
        pdf.save('qr-code.pdf');
      } else {
        const options = {
          quality: 1.0,
          backgroundColor: '#ffffff',
          style: {
            transform: 'none',
            background: '#ffffff'
          }
        };

        const convertFn = format === 'png' ? toPng : toJpeg;
        const dataUrl = await convertFn(downloadRef.current, options);
        
        const link = document.createElement('a');
        link.download = `qr-code.${format}`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      setError('Error downloading image. Please try again.');
    }
  };

  const startEditingDescription = () => {
    setTempDescription(orgDescription);
    setEditingDescription(true);
  };

  const startEditingPurpose = () => {
    setTempPurpose(urlPurpose);
    setEditingPurpose(true);
  };

  const saveDescription = () => {
    setOrgDescription(tempDescription);
    setEditingDescription(false);
  };

  const savePurpose = () => {
    setUrlPurpose(tempPurpose);
    setEditingPurpose(false);
  };



  // Downloadable content without edit buttons
  const DownloadableContent = () => (
    <div className="bg-white p-8 flex flex-col items-center justify-center space-y-8">
      {logo && (
        <div className="mb-8">
          <img src={logo} alt="Organization logo" className="max-w-[200px] h-auto" />
        </div>
      )}
      <div className="p-8 rounded-lg" style={{ backgroundColor: bgColor }}>
        <QRCodeCanvas
          value={url || 'https://example.org'}
          size={size * 2} // Double the size for better quality
          fgColor={qrColor}
          bgColor={bgColor}
          level="H"
          includeMargin={true}
        />
      </div>
      
      {orgDescription && (
        <div className="text-center max-w-3xl">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">About the Organization</h3>
          <p className="text-xl text-gray-700 leading-relaxed">{orgDescription}</p>
        </div>
      )}

      {urlPurpose && (
        <div className="text-center max-w-3xl mt-8">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">Purpose</h3>
          <p className="text-xl text-gray-700 leading-relaxed">{urlPurpose}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-indigo-900 mb-4">
            Non-Profit QR Code Generator
          </h1>
          <p className="text-gray-600">
            Create beautiful QR codes for your non-profit organization
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL
              </label>
              <div className="relative">
                <Link className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-nonprofit.org"
                  className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <LogoUpload onLogoChange={setLogo} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Description
              </label>
              <div className="relative">
                <Heart className="absolute left-3 top-3 text-gray-400" size={20} />
                <textarea
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Tell us about your organization..."
                  className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                />
                <button
                  onClick={() => generateAIText('description')}
                  className={`absolute right-3 top-3 text-indigo-600 hover:text-indigo-800 transition-colors ${isGenerating ? 'animate-spin' : ''}`}
                  disabled={isGenerating}
                  title="Generate AI description"
                >
                  <Wand2 size={20} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL Purpose
              </label>
              <div className="relative">
                <Info className="absolute left-3 top-3 text-gray-400" size={20} />
                <textarea
                  value={urlPurpose}
                  onChange={(e) => setUrlPurpose(e.target.value)}
                  placeholder="What's the purpose of this URL? (e.g., Fundraising campaign, Newsletter signup)"
                  className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                />
                <button
                  onClick={() => generateAIText('purpose')}
                  className={`absolute right-3 top-3 text-indigo-600 hover:text-indigo-800 transition-colors ${isGenerating ? 'animate-spin' : ''}`}
                  disabled={isGenerating}
                  title="Generate AI purpose text"
                >
                  <Wand2 size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Code Color
                </label>
                <input
                  type="color"
                  value={qrColor}
                  onChange={(e) => setQrColor(e.target.value)}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Background Color
                </label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Size: {size}px
              </label>
              <input
                type="range"
                min="128"
                max="512"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div ref={qrRef} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
              {/* Preview with edit buttons */}
              <div className="flex flex-col items-center justify-center">
                {logo && (
                  <div className="mb-8">
                    <img src={logo} alt="Organization logo" className="max-w-[200px] h-auto" />
                  </div>
                )}
                <div className="p-4 rounded-lg" style={{ backgroundColor: bgColor }}>
                  <QRCodeCanvas
                    value={url || 'https://example.org'}
                    size={size}
                    fgColor={qrColor}
                    bgColor={bgColor}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>

              {(orgDescription || editingDescription) && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-gray-900">About the Organization</h3>
                    {!editingDescription ? (
                      <button
                        onClick={startEditingDescription}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={saveDescription}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                  {!editingDescription ? (
                    <p className="text-gray-600">{orgDescription}</p>
                  ) : (
                    <textarea
                      value={tempDescription}
                      onChange={(e) => setTempDescription(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                    />
                  )}
                </div>
              )}

              {(urlPurpose || editingPurpose) && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-gray-900">Purpose</h3>
                    {!editingPurpose ? (
                      <button
                        onClick={startEditingPurpose}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <Edit2 size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={savePurpose}
                        className="text-green-600 hover:text-green-800"
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                  {!editingPurpose ? (
                    <p className="text-gray-600">{urlPurpose}</p>
                  ) : (
                    <textarea
                      value={tempPurpose}
                      onChange={(e) => setTempPurpose(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={3}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Download Options
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {['png', 'jpg', 'pdf'].map((format) => (
                  <button
                    key={format}
                    onClick={() => downloadImage(format as 'png' | 'jpg' | 'pdf')}
                    disabled={!user}
                    className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors
                      ${user 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  >
                    <Download size={20} />
                    <span className="uppercase">{format}</span>
                  </button>
                ))}
              </div>
              {!user && (
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Please provide your information below to enable downloads
                </p>
              )}
            </div>

            {!user && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Enable Downloads
                </h3>
                <UserForm onSubmit={handleUserSubmit} isSubmitting={isSubmitting} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden downloadable content */}
      <div className="fixed left-[-9999px] top-[-9999px]" aria-hidden="true">
        <div ref={downloadRef}>
          <DownloadableContent />
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;