import React, { useEffect, useCallback, useRef } from "react";
import {
  Compass,
  MapPin,
  Route as RouteIcon,
  Accessibility,
  Navigation,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Info,
} from "lucide-react";

export type TourStep = {
  id: string;
  title: string;
  badge: string;
  icon: React.ReactNode;
  description: string;
  actionLabel?: string;
  action?: () => void;
};

export type VisitorTourProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace?: (placeId: string) => void;
  onStartRoute?: (placeId: string) => void;
  onToggleStepFree?: (val: boolean) => void;
  onSwitchView?: (view: "navigate" | "connect") => void;
};

export default function VisitorTour({
  isOpen,
  onClose,
  onSelectPlace,
  onStartRoute,
  onToggleStepFree,
  onSwitchView,
}: VisitorTourProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      id: "welcome",
      title: "Welcome to UniWay",
      badge: "Smart Navigation",
      icon: <Sparkles size={20} className="tour-step-icon-accent" />,
      description:
        "UniWay is a privacy-first, local-oriented smart campus navigation platform. All map computing, OCR analysis, and Dijkstra routing run 100% in your browser with zero cloud tracking.",
    },
    {
      id: "explore",
      title: "Explore Campus Landmarks",
      badge: "Discovery",
      icon: <Compass size={20} className="tour-step-icon-accent" />,
      description:
        "Easily find lecture halls, libraries, dining commons, accessible restrooms, and visitor parking. Use the category pills or instant search to locate any building on campus.",
      actionLabel: "Find Central Library",
      action: () => {
        onSelectPlace?.("central-library");
      },
    },
    {
      id: "details",
      title: "Landmark Details & Accessibility",
      badge: "Accessibility",
      icon: <MapPin size={20} className="tour-step-icon-accent" />,
      description:
        "Selecting a landmark displays detailed building information, hours of operation, and confirmed step-free accessibility before you begin walking.",
      actionLabel: "Inspect Library",
      action: () => {
        onSelectPlace?.("central-library");
      },
    },
    {
      id: "routing",
      title: "Smart Pathfinding & Alternatives",
      badge: "Optimal Routing",
      icon: <RouteIcon size={20} className="tour-step-icon-accent" />,
      description:
        "UniWay calculates the shortest path using Dijkstra's algorithm alongside loop-free alternative routes via Yen's algorithm. Never get stuck at a crowded doorway.",
      actionLabel: "Route to Library",
      action: () => {
        onStartRoute?.("central-library");
      },
    },
    {
      id: "step-free",
      title: "Step-Free Accessibility",
      badge: "Inclusive Mobility",
      icon: <Accessibility size={20} className="tour-step-icon-accent" />,
      description:
        "Need barrier-free navigation? Toggle Step-Free Routing to avoid all staircases and automatically route via wheelchair ramps and smooth paved paths.",
      actionLabel: "Enable Step-Free",
      action: () => {
        onToggleStepFree?.(true);
      },
    },
    {
      id: "turn-by-turn",
      title: "Turn-by-Turn Guidance",
      badge: "Live Wayfinding",
      icon: <Navigation size={20} className="tour-step-icon-accent" />,
      description:
        "Follow clear step-by-step instructions. The animated emerald beacon pulses at your location on the map, updating smoothly as you progress toward your destination.",
    },
    {
      id: "connect",
      title: "UniWay Connect Community",
      badge: "Module B",
      icon: <Users size={20} className="tour-step-icon-accent" />,
      description:
        "Beyond physical maps, UniWay Connect unites campus life: discover student clubs, volunteer opportunities, marketplace trade, and official campus announcements.",
      actionLabel: "Explore UniWay Connect",
      action: () => {
        onSwitchView?.("connect");
        onClose();
      },
    },
  ];

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  }, [currentStep, steps.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Reset to first step when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      containerRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div
      className="visitor-tour-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="UniWay Interactive Visitor Walkthrough"
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="visitor-tour-card glass-panel">
        <div className="visitor-tour-header">
          <div className="visitor-tour-badge">
            {step.icon}
            <span>{step.badge}</span>
          </div>
          <span className="visitor-tour-counter">
            {currentStep + 1} of {steps.length}
          </span>
          <button
            type="button"
            className="visitor-tour-close icon-button"
            onClick={onClose}
            aria-label="Close walkthrough"
          >
            <X size={16} />
          </button>
        </div>

        <div className="visitor-tour-body">
          <h2 className="visitor-tour-title">{step.title}</h2>
          <p className="visitor-tour-desc">{step.description}</p>

          {step.actionLabel && step.action && (
            <div className="visitor-tour-interactive-action">
              <button
                type="button"
                className="visitor-tour-action-btn"
                onClick={step.action}
              >
                <Info size={14} />
                <span>{step.actionLabel}</span>
              </button>
            </div>
          )}
        </div>

        <div className="visitor-tour-footer">
          <div className="visitor-tour-dots" aria-hidden="true">
            {steps.map((s, idx) => (
              <span
                key={s.id}
                className={`visitor-tour-dot ${idx === currentStep ? "active" : ""}`}
                onClick={() => setCurrentStep(idx)}
              />
            ))}
          </div>

          <div className="visitor-tour-nav">
            {!isFirst && (
              <button
                type="button"
                className="visitor-tour-btn secondary"
                onClick={handlePrev}
                aria-label="Previous step"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              className="visitor-tour-btn primary"
              onClick={handleNext}
              aria-label={isLast ? "Finish walkthrough" : "Next step"}
            >
              <span>{isLast ? "Finish Tour" : "Next"}</span>
              {isLast ? <Check size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
