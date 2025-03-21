import React, { FormEvent } from 'react';

import { Form, FormField, FormTextArea } from './Form';

export default {
  title: 'Components/Form',
  component: Form,
};

export const Default = {
  render: () => {
    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const form = e.target as HTMLFormElement;
      const name = (form.elements.namedItem('name') as HTMLInputElement).value;
      const email = (form.elements.namedItem('email') as HTMLInputElement)
        .value;
      const message = (
        form.elements.namedItem('message') as HTMLTextAreaElement
      ).value;

      alert(
        `Submitted Data:\n\nName: ${name}\nEmail: ${email}\nMessage: ${message}`,
      );
    };

    return (
      <Form className="min-w-sm md:min-w-md" onSubmit={handleSubmit}>
        <FormField
          name="name"
          label="Your Name"
          placeholder="Enter your name"
        />
        <FormField
          name="email"
          label="Your Email"
          placeholder="Enter your email"
        />
        <FormTextArea
          name="message"
          label="Your Message"
          placeholder="Type your message here..."
        />
      </Form>
    );
  },
};
