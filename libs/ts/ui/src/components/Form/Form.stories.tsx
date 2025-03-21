'use client';

import React, { useState } from 'react';

import { Form, FormField, FormTextArea, FormContext } from './Form';

export default {
  title: 'Components/Form',
  component: Form,
};

export const DefaultContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert(
      `Form Submitted!\nName: ${formData.name}\nEmail: ${formData.email}\nMessage: ${formData.message}`,
    );
  };

  return (
    <FormContext.Provider
      value={{
        values: formData,
        setValue: (name: string, value: string | boolean | null) => {
          setFormData(prev => ({
            ...prev,
            [name]: value === null ? '' : String(value),
          }));
        },
        resetForm: () => setFormData({ name: '', email: '', message: '' }),
        clearMessages: () => {},
      }}
    >
      <div className="max-w-lg mx-auto p-4 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
        <p className="mb-4">
          If you have any questions, inquiries, or comments, feel free to reach
          out to us!
        </p>
        <Form
          onSubmit={handleSubmit}
          successMessage="Your message has been sent. We will get back to you soon!"
        >
          <FormField name="name" label="Your Name" />
          <FormField name="email" label="Email Address" />
          <FormTextArea name="message" label="Your Message" />
        </Form>
      </div>
    </FormContext.Provider>
  );
};
