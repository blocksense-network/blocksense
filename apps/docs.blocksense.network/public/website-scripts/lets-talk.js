// <script src="https://docs.blocksense.network/website-scripts/lets-talk.js" defer></script>

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.lets-talk_form');
  const nameInput = document.getElementById('Name');
  const email = document.getElementById('Email');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const emailValue = email.value.trim();
    if (!emailValue) return;

    try {
      await fetch(
        'https://social-verification.blocksense.network/verify/letsTalk/sendEmail',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'qe3AkeO3I9fmCszlAgQ5DFLACD1fkFoe',
          },
          body: JSON.stringify({
            email: emailValue,
            name: nameInput.value.trim(),
          }),
        },
      );
    } catch (err) {
      console.error(err);
    }
  });
});
