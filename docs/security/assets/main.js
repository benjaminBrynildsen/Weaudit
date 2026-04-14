const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

document.getElementById('year').textContent = new Date().getFullYear();

const animateCount = (el) => {
  const target = Number(el.dataset.count || '0');
  const duration = 1000;
  const start = performance.now();

  const frame = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.floor(target * eased));
    if (progress < 1) requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
};

document.querySelectorAll('[data-count]').forEach((el) => {
  const counterObserver = new IntersectionObserver(
    (entries, obs) => {
      if (entries[0].isIntersecting) {
        animateCount(el);
        obs.disconnect();
      }
    },
    { threshold: 0.6 }
  );

  counterObserver.observe(el);
});
