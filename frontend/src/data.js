// The 10 available designs (themes). Each maps to a .theme-<id> CSS class.
export const THEMES = [
  { id: "aurora", label: "Aurora", c1: "#6c5ce7", c2: "#a29bfe" },
  { id: "noir", label: "Noir", c1: "#1a1a20", c2: "#d4af37" },
  { id: "minimal", label: "Minimal", c1: "#111111", c2: "#888888" },
  { id: "ocean", label: "Ocean", c1: "#0ea5e9", c2: "#06b6d4" },
  { id: "sunset", label: "Sunset", c1: "#f97316", c2: "#ec4899" },
  { id: "forest", label: "Forest", c1: "#16a34a", c2: "#65a30d" },
  { id: "mono", label: "Mono", c1: "#111111", c2: "#555555" },
  { id: "coral", label: "Coral", c1: "#ff5a5f", c2: "#ff8a5c" },
  { id: "royal", label: "Royal", c1: "#1e3a8a", c2: "#f59e0b" },
  { id: "candy", label: "Candy", c1: "#8b5cf6", c2: "#ec4899" },
];
export const themeGradient = (id) => {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  return `linear-gradient(135deg, ${t.c1}, ${t.c2})`;
};

// Subscription plans (prices in ₹). Shared by the Home pricing section and the
// Subscribe flow. Edit freely.
export const PLANS = [
  {
    id: "starter", name: "Starter", price: 199, period: "one-time",
    features: ["1 portfolio website", "All 20 layouts & 10 colors", "Image uploads", "Shareable live link"],
  },
  {
    id: "professional", name: "Professional", price: 499, period: "one-time", popular: true,
    features: ["Everything in Starter", "Interactive 3D design", "Custom section titles", "Priority rendering"],
  },
  {
    id: "business", name: "Business", price: 999, period: "one-time",
    features: ["Everything in Professional", "Premium support", "Early access to new designs", "Remove branding (soon)"],
  },
];

// The 10 available layouts (structure). Each maps to a .layout-<id> CSS class.
export const LAYOUTS = [
  { id: "classic", label: "Classic" },
  { id: "centered", label: "Centered" },
  { id: "split", label: "Split" },
  { id: "showcase", label: "Showcase" },
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold" },
  { id: "wide", label: "Wide" },
  { id: "compact", label: "Compact" },
  { id: "elegant", label: "Elegant" },
  { id: "modern", label: "Modern" },
  { id: "stack", label: "Stack" },
  { id: "frame", label: "Frame" },
  { id: "duo", label: "Duotone" },
  { id: "rounded", label: "Rounded" },
  { id: "editorial", label: "Editorial" },
  { id: "spotlight", label: "Spotlight" },
  { id: "grid", label: "Grid" },
  { id: "band", label: "Band" },
  { id: "clean", label: "Clean" },
  { id: "studio", label: "Studio" },
  { id: "engineer", label: "Engineer" },
];
export const layoutLabel = (id) => (LAYOUTS.find((x) => x.id === id) || LAYOUTS[0]).label;

// The professional dummy data every new user starts from. They edit it in place.
export const DEFAULT_DATA = {
  theme: "aurora",
  layout: "classic",
  // Editable section titles (businesses can rename these)
  hServices: "Services",
  hSkills: "Skills",
  hWork: "Recent Work",
  hResume: "Experience & Education",
  hExperience: "Experience",
  hEducation: "Education",
  hAchievements: "Achievements & Awards",
  hTestimonials: "What Clients Say",
  // Hero
  name: "Alex Morgan",
  role: "Creative Designer & Developer",
  greeting: "Hello, I'm",
  tagline:
    "I craft clean, modern digital experiences that help brands and people stand out online. Available for freelance projects worldwide.",
  image: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=600&q=80",
  ctaText: "Hire Me",
  resumeText: "Download CV",
  resumeUrl: "#",
  socials: {
    github: "#",
    linkedin: "#",
    twitter: "#",
    instagram: "#",
    dribbble: "#",
  },

  // Stats
  stats: [
    { value: "8+", label: "Years Experience" },
    { value: "120+", label: "Projects Done" },
    { value: "75+", label: "Happy Clients" },
    { value: "15", label: "Awards Won" },
  ],

  // About
  aboutHeading: "I design & build digital products people love",
  about:
    "I'm a multidisciplinary designer and developer with over 8 years of experience helping startups and established brands ship beautiful, usable products. I care deeply about the details — typography, motion, and the small interactions that make a product feel alive. When I'm not designing, you'll find me writing about design systems and mentoring junior creatives.",
  personal: {
    email: "hello@alexmorgan.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, USA",
    availability: "Available for freelance",
    languages: "English, Spanish",
  },

  // Services
  services: [
    { icon: "fa-pen-ruler", title: "UI / UX Design", desc: "Intuitive, research-driven interfaces that turn visitors into customers." },
    { icon: "fa-code", title: "Web Development", desc: "Fast, responsive, accessible websites built with modern frameworks." },
    { icon: "fa-mobile-screen", title: "Mobile Apps", desc: "Native-feeling iOS & Android apps with delightful user experiences." },
    { icon: "fa-bullhorn", title: "Brand Identity", desc: "Logos, style guides and visual systems that make brands memorable." },
    { icon: "fa-chart-line", title: "SEO & Strategy", desc: "Data-backed strategy to grow your traffic and reach the right audience." },
    { icon: "fa-palette", title: "Design Systems", desc: "Scalable component libraries that keep teams fast and consistent." },
  ],

  // Skills
  skills: [
    { name: "UI/UX Design", percent: 95 },
    { name: "React & JavaScript", percent: 90 },
    { name: "Figma & Prototyping", percent: 92 },
    { name: "HTML & CSS", percent: 96 },
    { name: "Branding", percent: 85 },
    { name: "SEO", percent: 80 },
  ],

  // Projects
  projects: [
    { title: "Finance Dashboard", category: "Web App", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80", desc: "A clean analytics dashboard for a fintech startup.", url: "#" },
    { title: "Travel Booking App", category: "Mobile", image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80", desc: "End-to-end booking experience with offline support.", url: "#" },
    { title: "Coffee Brand Identity", category: "Branding", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80", desc: "Full brand identity for an artisan coffee roaster.", url: "#" },
    { title: "E-commerce Redesign", category: "Web Design", image: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=600&q=80", desc: "Conversion-focused redesign, +34% checkout rate.", url: "#" },
    { title: "Fitness Tracker", category: "Mobile", image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=600&q=80", desc: "Habit-building fitness app with social features.", url: "#" },
    { title: "SaaS Landing Page", category: "Web Design", image: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?auto=format&fit=crop&w=600&q=80", desc: "High-converting marketing site for a B2B SaaS.", url: "#" },
  ],

  // Experience
  experience: [
    { role: "Senior Product Designer", company: "TechFlow Inc.", period: "2021 — Present", desc: "Lead designer for the flagship product, managing a team of 4 and shipping features used by 2M+ users." },
    { role: "UI/UX Designer", company: "Pixel Studio", period: "2018 — 2021", desc: "Designed web and mobile products for 20+ clients across fintech, health and e-commerce." },
    { role: "Frontend Developer", company: "StartUp Labs", period: "2016 — 2018", desc: "Built responsive web apps in React and collaborated closely with design and product teams." },
  ],

  // Education
  education: [
    { degree: "M.A. Interaction Design", company: "California Institute of Arts", period: "2014 — 2016", desc: "Focused on human-centered design and design research methods." },
    { degree: "B.Sc. Computer Science", company: "University of Washington", period: "2010 — 2014", desc: "Graduated with honors; minor in visual communication." },
  ],

  // Achievements
  achievements: [
    { icon: "fa-trophy", title: "Awwwards Site of the Day", subtitle: "2023" },
    { icon: "fa-award", title: "Top 100 Designers", subtitle: "Design Weekly" },
    { icon: "fa-medal", title: "Best UX Award", subtitle: "UX Conf 2022" },
  ],

  // Testimonials
  testimonials: [
    { text: "Alex transformed our product. The new design lifted our conversion rate by over 30% and our users love it.", author: "Sarah Chen", role: "CEO, FinTech Co", avatar: "https://i.pravatar.cc/100?img=45" },
    { text: "Incredibly talented and a pleasure to work with. Delivered ahead of schedule and exceeded expectations.", author: "Michael Lee", role: "Founder, Pixel Studio", avatar: "https://i.pravatar.cc/100?img=12" },
    { text: "One of the few designers who truly understands both aesthetics and business goals. Highly recommended.", author: "Jessica Park", role: "Product Lead, SaaSly", avatar: "https://i.pravatar.cc/100?img=32" },
  ],

  // Contact
  contactHeading: "Let's work together",
  contactText: "Have a project in mind or just want to say hi? Fill out the form and I'll get back to you within 24 hours.",
};

// ---- list helpers (stable ids while editing) ----
let _uid = 1;
export const newId = () => `id_${_uid++}`;

const LIST_KEYS = ["stats", "services", "skills", "projects", "experience", "education", "achievements", "testimonials"];

export function withIds(data) {
  const d = structuredClone(data);
  for (const key of LIST_KEYS) {
    if (Array.isArray(d[key])) d[key] = d[key].map((item) => ({ _id: newId(), ...item }));
  }
  return d;
}

export function stripIds(data) {
  const d = structuredClone(data);
  for (const key of LIST_KEYS) {
    if (Array.isArray(d[key])) d[key] = d[key].map(({ _id, ...rest }) => rest);
  }
  return d;
}

export const SOCIAL_KEYS = ["github", "linkedin", "twitter", "instagram", "dribbble", "youtube", "facebook"];
