import React, { useState, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface LogoUploadProps {
  onLogoChange: (logo: string | null) => void;
}

const LogoUpload: React.FC<LogoUploadProps> = ({ onLogoChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 100 || img.height < 100) {
          setError('Image must be at least 100x100 pixels');
          resolve(false);
        } else if (img.width > 2000 || img.height > 2000) {
          setError('Image must be no larger than 2000x2000 pixels');
          resolve(false);
        } else {
          setError('');
          resolve(true);
        }
      };
      img.onerror = () => {
        setError('Invalid image file');
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const processImage = async (file: File) => {
    try {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      const isValid = await validateImage(file);
      if (!isValid) return;

      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1000,
        useWebWorker: true
      };

      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setPreview(base64data);
        onLogoChange(base64data);
      };

      reader.readAsDataURL(compressedFile);
    } catch (err) {
      setError('Error processing image');
      console.error('Error processing image:', err);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const { files } = e.dataTransfer;
    if (files && files[0]) {
      processImage(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onLogoChange(null);
    setError('');
  };

  return (
    <div className="w-full space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Organization Logo
      </label>
      
      {preview ? (
        <div className="relative w-full max-w-xs mx-auto">
          <img
            src={preview}
            alt="Logo preview"
            className="w-full h-auto rounded-lg shadow-md"
          />
          <button
            onClick={handleRemove}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            title="Remove logo"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-6 
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50' 
              : 'border-gray-300 hover:border-indigo-400'
            } transition-colors cursor-pointer`}
        >
          <input
            type="file"
            onChange={handleFileInput}
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Upload logo"
          />
          
          <div className="flex flex-col items-center justify-center space-y-2">
            {isDragging ? (
              <Upload className="w-12 h-12 text-indigo-500" />
            ) : (
              <ImageIcon className="w-12 h-12 text-gray-400" />
            )}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Drag and drop your logo here, or click to select
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, GIF up to 5MB
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      
      <p className="text-xs text-gray-500">
        Recommended: Square logo between 200x200 and 1000x1000 pixels
      </p>
    </div>
  );
};

export default LogoUpload;