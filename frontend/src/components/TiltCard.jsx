import { useRef } from "react";

/**
 * Wraps children in a card that tilts in 3D toward the cursor and shows a
 * soft glare following the pointer. `restTransform` is the resting pose
 * (e.g. a static rotation) the card eases back to on mouse-leave, so static
 * rotation and the hover tilt don't fight over the `transform` property.
 */
export default function TiltCard({
  children,
  className = "",
  style,
  intensity = 10,
  restTransform = "",
  as: Tag = "div",
  ...props
}) {
  const ref = useRef(null);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `${restTransform} perspective(1000px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) translateY(-6px) scale(1.02)`;
    el.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = restTransform;
  };

  return (
    <Tag
      ref={ref}
      className={`tilt-card ${className}`}
      style={{ transform: restTransform, ...style }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...props}
    >
      <span className="tilt-glare" aria-hidden="true" />
      {children}
    </Tag>
  );
}
