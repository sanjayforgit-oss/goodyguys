document.addEventListener('DOMContentLoaded', function() {
  // 1. Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      nav.classList.toggle('active');
      menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
    });

    document.addEventListener('click', function(e) {
      if (nav.classList.contains('active') && !nav.contains(e.target) && !menuToggle.contains(e.target)) {
        nav.classList.remove('active');
        menuToggle.textContent = '☰';
      }
    });

    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        nav.classList.remove('active');
        menuToggle.textContent = '☰';
      });
    });
  }

  // 2. Header shadow on scroll
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // 3. Hero Carousel Slider Controller
  const heroCarousel = document.getElementById('heroCarousel');
  if (heroCarousel) {
    const slides = heroCarousel.querySelectorAll('.carousel-slide');
    const dots = heroCarousel.querySelectorAll('.carousel-dot');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    let currentIndex = 0;
    let autoSlideTimer = null;

    function showSlide(index) {
      if (slides.length === 0) return;
      if (index >= slides.length) index = 0;
      if (index < 0) index = slides.length - 1;
      currentIndex = index;

      slides.forEach((slide, i) => {
        if (i === currentIndex) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });

      dots.forEach((dot, i) => {
        if (i === currentIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    function startAutoSlide() {
      stopAutoSlide();
      autoSlideTimer = setInterval(() => {
        showSlide(currentIndex + 1);
      }, 5000);
    }

    function stopAutoSlide() {
      if (autoSlideTimer) {
        clearInterval(autoSlideTimer);
        autoSlideTimer = null;
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        showSlide(currentIndex - 1);
        startAutoSlide();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        showSlide(currentIndex + 1);
        startAutoSlide();
      });
    }

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.getAttribute('data-index')) || 0;
        showSlide(idx);
        startAutoSlide();
      });
    });

    heroCarousel.addEventListener('mouseenter', stopAutoSlide);
    heroCarousel.addEventListener('mouseleave', startAutoSlide);

    startAutoSlide();
  }

  // 4. Quantity controls
  window.incrementQty = function() {
    const input = document.getElementById('quantity');
    if (input) {
      const val = parseInt(input.value) || 1;
      if (val < 99) input.value = val + 1;
    }
  };

  window.decrementQty = function() {
    const input = document.getElementById('quantity');
    if (input) {
      const val = parseInt(input.value) || 1;
      if (val > 1) input.value = val - 1;
    }
  };

  // 5. Active nav link
  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPath + currentSearch || (href !== '/' && currentPath.startsWith(href) && !href.includes('?'))) {
      a.classList.add('active');
    }
  });
});
