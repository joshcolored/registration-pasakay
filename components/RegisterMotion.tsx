'use client';

import { RefObject, useEffect } from 'react';

export function useRegisterScrollMotion(scopeRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    async function setupMotion() {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (!isMounted) return;

      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.fromTo(
          '.gsap-hero',
          { autoAlpha: 0, y: 36, filter: 'blur(10px)' },
          {
            autoAlpha: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.08,
          }
        );

        gsap.utils.toArray<HTMLElement>('.gsap-card').forEach((card) => {
          gsap.fromTo(
            card,
            { autoAlpha: 0, y: 46, scale: 0.98 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.8,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 86%',
              },
            }
          );
        });

        gsap.utils.toArray<HTMLElement>('.gsap-float').forEach((item, index) => {
          gsap.to(item, {
            y: index % 2 === 0 ? 18 : -18,
            rotate: index % 2 === 0 ? 3 : -3,
            duration: 3.5 + index * 0.35,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          });
        });
      }, scope as Element);

      cleanup = () => ctx.revert();
    }

    setupMotion();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [scopeRef]);
}
