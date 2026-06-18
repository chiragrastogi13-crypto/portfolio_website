import { Children, useEffect, useRef, useState } from "react";

/**
 * Lightweight, swipeable carousel built on native scroll-snap (so touch
 * swipe works for free). Autoplay loops back to the start at the end and
 * pauses while the pointer is over the carousel.
 */
export default function Carousel({ children, autoplay = true, interval = 4000, className = "" }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = Children.toArray(children);

  const next = () => {
    const track = trackRef.current;
    if (!track) return;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    if (atEnd) track.scrollTo({ left: 0, behavior: "smooth" });
    else track.scrollBy({ left: track.clientWidth * 0.86, behavior: "smooth" });
  };

  const prev = () => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: -track.clientWidth * 0.86, behavior: "smooth" });
  };

  const scrollToIndex = (i) => {
    const track = trackRef.current;
    const slide = track?.children[i];
    if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    let closest = 0, min = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const d = Math.abs(child.offsetLeft - track.scrollLeft);
      if (d < min) { min = d; closest = i; }
    });
    setActiveIndex(closest);
  };

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => {
      if (!pausedRef.current) next();
    }, interval);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, interval]);

  return (
    <div
      className={`carousel-wrap ${className}`}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <button className="carousel-arrow carousel-arrow-l" onClick={prev} aria-label="Previous slide" type="button">
        <i className="fas fa-chevron-left"></i>
      </button>
      <div className="carousel-track" ref={trackRef} onScroll={onScroll}>
        {slides.map((slide, i) => (
          <div className="carousel-slide" key={i}>{slide}</div>
        ))}
      </div>
      <button className="carousel-arrow carousel-arrow-r" onClick={next} aria-label="Next slide" type="button">
        <i className="fas fa-chevron-right"></i>
      </button>

      <div className="carousel-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`carousel-dot ${i === activeIndex ? "active" : ""}`}
            onClick={() => scrollToIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
