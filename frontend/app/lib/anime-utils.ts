import { animate, stagger, Spring, cubicBezier } from 'animejs';

/**
 * Spring slide in from left. Used for mobile sidebar open.
 */
export function springIn(el: HTMLElement, fromX?: string): void {
  animate(el, {
    translateX: { from: fromX ?? '-100%', to: '0%' },
    ease: new Spring({ mass: 1, stiffness: 80, damping: 10, velocity: 8 }),
  });
}

/**
 * Fast exit to left. Used for mobile sidebar close.
 */
export function fastOut(el: HTMLElement, toX?: string): void {
  animate(el, {
    translateX: { from: '0%', to: toX ?? '-100%' },
    duration: 260,
    ease: 'inCubic',
  });
}

/**
 * Stagger fade + slide up on multiple elements. Used for message cascade.
 */
export function staggerFadeUp(
  els: HTMLElement[],
  delayBetween = 80,
  duration = 450
): void {
  // Reset initial state so animation always starts from zero
  els.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
  });
  animate(els, {
    opacity: { from: 0, to: 1 },
    translateY: { from: 12, to: 0 },
    delay: stagger(delayBetween),
    ease: cubicBezier(0.22, 1, 0.36, 1),
    duration,
  });
}

/**
 * Ripple + scale on send button click.
 * btn must have `position: relative; overflow: hidden` (caller's responsibility).
 */
export function rippleBurst(btn: HTMLElement, e: MouseEvent): void {
  const rect = btn.getBoundingClientRect();
  // Center ripple if no real click position (keyboard activation)
  const x = e.clientX !== 0 ? e.clientX - rect.left : rect.width / 2;
  const y = e.clientY !== 0 ? e.clientY - rect.top : rect.height / 2;
  const ripple = document.createElement('div');

  Object.assign(ripple.style, {
    position: 'absolute',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.3)',
    transform: 'scale(0)',
    left: `${x - 30}px`,
    top: `${y - 30}px`,
    pointerEvents: 'none',
  });

  btn.appendChild(ripple);

  animate(btn, {
    scale: [1, 0.93, 1],
    duration: 320,
    ease: 'inOutBack',
  });

  animate(ripple, {
    scale: [0, 3],
    opacity: [0.5, 0],
    duration: 480,
    ease: 'outQuad',
    onComplete: () => ripple.remove(),
  });
}

/**
 * Horizontal shake + red border flash. Used on textarea when submitted empty.
 */
export function shakeX(el: HTMLElement): void {
  animate(el, {
    translateX: [0, -7, 7, -5, 5, -2, 2, 0],
    duration: 450,
    ease: 'inOutSine',
  });
  // Use boxShadow since textarea has border: none
  animate(el, {
    boxShadow: [
      '0 0 0 0px rgba(224,87,87,0)',
      '0 0 0 2px rgba(224,87,87,0.7)',
      '0 0 0 0px rgba(224,87,87,0)',
    ],
    duration: 480,
    ease: 'linear',
  });
}

/**
 * Scale + border-color pulse. Used on new chat button.
 */
export function pulseBorder(el: HTMLElement): void {
  animate(el, {
    scale: [1, 1.08, 1],
    borderColor: ['#c9a84c', '#6b3fa0', '#c9a84c'],
    duration: 420,
    ease: 'inOutSine',
  });
}

/**
 * Gold curtain wipe Promise sequence. Used for new chat transition.
 */
export function goldSweep(
  overlay: HTMLElement,
  onBehindCurtain: () => void,
  onDone: () => void
): void {
  animate(overlay, {
    translateX: { from: '-101%', to: '0%' },
    duration: 420,
    ease: 'inOutQuart',
    onComplete: () => {
      onBehindCurtain();
      animate(overlay, {
        translateX: { from: '0%', to: '101%' },
        duration: 380,
        ease: 'inOutQuart',
        onComplete: () => {
          // Reset so subsequent calls start correctly
          overlay.style.transform = 'translateX(-101%)';
          onDone();
        },
      });
    },
  });
}

/**
 * Login ceremony animation. Used on auth success.
 */
export function royalFlourish(
  card: HTMLElement,
  particlesContainer: HTMLElement,
  ring: HTMLElement,
  onDone: () => void
): void {
  // Step 1: Card pulse
  animate(card, {
    scale: [1, 1.07, 0.96, 1.03, 1],
    duration: 500,
    ease: 'inOutSine',
  });

  // Step 2: Radial particle burst
  const particleCount = 16;
  const colors = ['#c9a84c', '#C8782E', '#fff', '#e8d5a3'];
  particlesContainer.innerHTML = ''; // clear before burst
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    const angle = (i / particleCount) * 360;
    const distance = 55 + Math.random() * 30; // 55–85px
    const duration = 700 + Math.random() * 200; // 700–900ms
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * distance;
    const ty = Math.sin(rad) * distance;

    Object.assign(particle.style, {
      position: 'absolute',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: colors[i % colors.length],
      top: '50%',
      left: '50%',
      marginTop: '-4px',
      marginLeft: '-4px',
      pointerEvents: 'none',
    });

    particlesContainer.appendChild(particle);

    animate(particle, {
      translateX: [0, tx],
      translateY: [0, ty],
      scale: [0, 1.5, 0],
      opacity: [0, 1, 0],
      duration,
      delay: i * 20,
      ease: 'outCubic',
      onComplete: () => particle.remove(),
    });
  }

  // Step 3: Ring expand + fade
  animate(ring, {
    scale: [0, 1.8],
    opacity: [0.9, 0],
    duration: 600,
    delay: 150,
    ease: 'outCubic',
  });

  // Step 4: Card fade out
  animate(card, {
    opacity: [1, 0],
    scale: [1, 0.85],
    duration: 350,
    delay: 450,
    ease: 'inQuad',
    onComplete: () => setTimeout(onDone, 300),
  });
}
