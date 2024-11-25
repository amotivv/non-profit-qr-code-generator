import React, { useState } from 'react';
import { User } from '../lib/supabase';

interface UserFormProps {
  onSubmit: (userData: Omit<User, 'id' | 'created_at' | 'app_ids'>) => Promise<void>;
  isSubmitting: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    ein: ''
  });
  const [emailError, setEmailError] = useState('');
  const [einError, setEinError] = useState('');

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  // EIN format: XX-XXXXXXX
  const einRegex = /^\d{2}-\d{7}$/;

  const validateEmail = (email: string): boolean => {
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
  
    setEmailError('');
    return true;
  };

  const validateEIN = (ein: string): boolean => {
    if (!ein) {
      setEinError('');
      return true; // EIN is optional
    }

    if (!einRegex.test(ein)) {
      setEinError('EIN must be in format: XX-XXXXXXX');
      return false;
    }

    setEinError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(formData.email) || !validateEIN(formData.ein)) {
      return;
    }

    const submitData = {
      ...formData,
      ein: formData.ein || undefined // Don't include empty EIN
    };

    await onSubmit(submitData);
  };

  const formatEIN = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as XX-XXXXXXX
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}-${digits.slice(2, 9)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'ein') {
      const formattedEIN = formatEIN(value);
      setFormData(prev => ({ ...prev, [name]: formattedEIN }));
      validateEIN(formattedEIN);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (name === 'email') {
        validateEmail(value);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={100}
          value={formData.name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          value={formData.email}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 sm:text-sm
            ${emailError 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-indigo-500'}`}
          placeholder="your@email.com"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? "email-error" : undefined}
        />
        {emailError && (
          <p className="mt-1 text-sm text-red-600" id="email-error">
            {emailError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="organization" className="block text-sm font-medium text-gray-700">
          Organization (optional)
        </label>
        <input
          type="text"
          id="organization"
          name="organization"
          value={formData.organization}
          onChange={handleChange}
          maxLength={200}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Your organization's name"
        />
      </div>

      <div>
        <label htmlFor="ein" className="block text-sm font-medium text-gray-700">
          EIN (optional)
        </label>
        <input
          type="text"
          id="ein"
          name="ein"
          value={formData.ein}
          onChange={handleChange}
          maxLength={10}
          className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 sm:text-sm
            ${einError 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-indigo-500'}`}
          placeholder="XX-XXXXXXX"
          aria-invalid={!!einError}
          aria-describedby={einError ? "ein-error" : undefined}
        />
        {einError && (
          <p className="mt-1 text-sm text-red-600" id="ein-error">
            {einError}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Format: XX-XXXXXXX (Federal Tax ID Number)
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !!emailError || !!einError}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
          ${(isSubmitting || !!emailError || !!einError) ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
      >
        {isSubmitting ? 'Saving...' : 'Enable Downloads'}
      </button>
    </form>
  );
};

export default UserForm;