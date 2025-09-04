document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('newsletter-email');
  const button = document.getElementById('submit-button');
  const successDiv = document.querySelector('.form_message-success');
  const errorDiv = document.querySelector('.form_message-error');

  button.addEventListener('click', async e => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email) return;

    try {
      const res = await fetch(
        'https://social-verification.blocksense.network/verify/newsletter/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'qe3AkeO3I9fmCszlAgQ5DFLACD1fkFoe',
          },
          body: JSON.stringify({
            email,
            interests: ['newsletter'],
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`Server error (${res.status})`);
      }
      emailInput.value = '';

      emailInput.style.display = 'none';
      button.style.display = 'none';

      successDiv.style.display = 'flex';
    } catch (err) {
      console.error(err);
      errorDiv.style.display = 'block';
    }
  });
});
