import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, TrendingUp, Award, Zap } from "lucide-react";

interface AuditCelebrationProps {
  show: boolean;
  onComplete: () => void;
  findingsCount?: number;
  savingsAmount?: number;
}

const celebrationMessages = [
  { text: "Nice work!", icon: Sparkles },
  { text: "Look at you crushing those audits!", icon: Award },
  { text: "Another one bites the dust!", icon: Zap },
  { text: "You're on fire!", icon: TrendingUp },
  { text: "Audit complete! You're amazing!", icon: Sparkles },
  { text: "Boom! Another audit in the books!", icon: Award },
];

export default function AuditCelebration({
  show,
  onComplete,
  findingsCount = 0,
  savingsAmount = 0,
}: AuditCelebrationProps) {
  const [message, setMessage] = useState(celebrationMessages[0]);

  useEffect(() => {
    if (show) {
      // Pick a random message
      const randomMessage =
        celebrationMessages[
          Math.floor(Math.random() * celebrationMessages.length)
        ];
      setMessage(randomMessage);

      // Fire confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          // Auto-close after confetti ends
          setTimeout(() => onComplete(), 500);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        // Fire confetti from multiple positions
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [show, onComplete]);

  const Icon = message.icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onComplete}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
            }}
            className="relative"
          >
            <div className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 border-2 border-primary/20 rounded-3xl p-12 shadow-2xl">
              {/* Animated icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="absolute -top-8 -right-8 bg-primary text-primary-foreground rounded-full p-4 shadow-lg"
              >
                <Icon className="w-8 h-8" />
              </motion.div>

              {/* Main message */}
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent"
              >
                {message.text}
              </motion.h1>

              {/* Stats */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex gap-8 justify-center mt-8"
              >
                {findingsCount > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {findingsCount}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {findingsCount === 1 ? "Finding" : "Findings"}
                    </div>
                  </div>
                )}
                {savingsAmount > 0 && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      ${savingsAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Revenue Lost
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Dismiss hint */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center text-xs text-muted-foreground mt-6"
              >
                Click anywhere to continue
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
