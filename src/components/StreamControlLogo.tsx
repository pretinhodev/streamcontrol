import React from "react";
import { motion } from "motion/react";
import { getPresetById, ColorPreset } from "../lib/theme";

interface StreamControlLogoProps {
  className?: string;
  size?: number | string;
  pulse?: boolean;
  presetId?: string; // Opt to specify a certain preset dynamically
  customPrimary?: string;
  customSecondary?: string;
}

export function StreamControlLogo({ className, size = 40, pulse = true, presetId, customPrimary, customSecondary }: StreamControlLogoProps) {
  // Try to find preset, default to cosmic-void
  // We can look up the globally active theme if presetId is not set,
  // but let's check saved local theme so fallback is always synchronized.
  const activePresetId = presetId || localStorage.getItem("streamcontrol_theme_id") || "cosmic-void";
  const cPrim = customPrimary || localStorage.getItem("streamcontrol_custom_primary") || "#FF007F";
  const cSec = customSecondary || localStorage.getItem("streamcontrol_custom_secondary") || "#7E00FF";
  
  const preset: ColorPreset = getPresetById(activePresetId, cPrim, cSec);

  // Numeric size conversion for calculations
  const numSize = typeof size === "number" ? size : parseInt(size.toString()) || 40;

  // Unique IDs for SVG gradients to support multiple parallel previews of different colors
  // Since custom changes, we can append the specific hex values (sanitized) to keep IDs isolated
  const hexHashSuffix = activePresetId === "custom" 
    ? `${cPrim.replace("#", "")}-${cSec.replace("#", "")}` 
    : activePresetId;
  const shadowId = `layerShadow-${hexHashSuffix}`;
  const gradBackId = `gradBack-${hexHashSuffix}`;
  const gradMiddleId = `gradMiddle-${hexHashSuffix}`;
  const gradFrontId = `gradFront-${hexHashSuffix}`;

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`} 
      style={{ width: numSize, height: numSize }}
    >
      {/* Pristine Ambient Glow - Pure, un-cluttered colored aura mapped to logo gradients */}
      {pulse && (
        <motion.div
          className={`absolute inset-0 rounded-full blur-xl ${preset.glowBg !== "custom-glow" ? `bg-gradient-to-tr ${preset.glowBg}` : ""}`}
          style={preset.glowBg === "custom-glow" ? {
            backgroundImage: `radial-gradient(circle, ${preset.primary}33 0%, ${preset.secondary}11 50%, transparent 100%)`
          } : {}}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Main SVG Container */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10"
      >
        <defs>
          {/* Shadow Filter for the premium 3D layered/overlapping look */}
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="-3" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.7" />
          </filter>

          {/* Layer 1 Gradient */}
          <linearGradient id={gradBackId} x1="0%" y1="20%" x2="100%" y2="80%">
            <stop offset="0%" stopColor={preset.gradBack[0]} />
            <stop offset="60%" stopColor={preset.gradBack[1]} />
            <stop offset="100%" stopColor={preset.gradBack[2]} />
          </linearGradient>

          {/* Layer 2 Gradient */}
          <linearGradient id={gradMiddleId} x1="0%" y1="20%" x2="100%" y2="80%">
            <stop offset="0%" stopColor={preset.gradMiddle[0]} />
            <stop offset="50%" stopColor={preset.gradMiddle[1]} />
            <stop offset="100%" stopColor={preset.gradMiddle[2]} />
          </linearGradient>

          {/* Layer 3 Gradient */}
          <linearGradient id={gradFrontId} x1="0%" y1="20%" x2="100%" y2="80%">
            <stop offset="0%" stopColor={preset.gradFront[0]} />
            <stop offset="50%" stopColor={preset.gradFront[1]} />
            <stop offset="100%" stopColor={preset.gradFront[2]} />
          </linearGradient>
        </defs>

        {/* 3D Layered Ribbons forming the geometric Stream Control logo */}
        
        {/* Layer 1 (Backmost Layer) */}
        <motion.path
          d="M 22,74 V 26 L 44,14 L 78,50 L 44,86 Z M 34,60 V 40 L 44,32 L 62,50 L 44,68 Z"
          fill={`url(#${gradBackId})`}
          fillRule="evenodd"
          transform="translate(-11, 0)"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: -11 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        />

        {/* Layer 2 (Middle Layer) */}
        <motion.path
          d="M 22,74 V 26 L 44,14 L 78,50 L 44,86 Z M 34,60 V 40 L 44,32 L 62,50 L 44,68 Z"
          fill={`url(#${gradMiddleId})`}
          fillRule="evenodd"
          filter={`url(#${shadowId})`}
          transform="translate(0, 0)"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        />

        {/* Layer 3 (Frontmost Layer) */}
        <motion.path
          d="M 22,74 V 26 L 44,14 L 78,50 L 44,86 Z M 34,60 V 40 L 44,32 L 62,50 L 44,68 Z"
          fill={`url(#${gradFrontId})`}
          fillRule="evenodd"
          filter={`url(#${shadowId})`}
          transform="translate(11, 0)"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 11 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
}
