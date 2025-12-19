import { useState, useEffect } from "react";
import chroma from "chroma-js";
import { /*Palette,*/ Shuffle, /*Plus,*/ /*Save,*/ /*Settings,*/ Check, Copy, X } from "lucide-react";
import { NAMED_COLORS } from "../src/lib/constants";

// --- Type Definitions ---
type ColorData = {
  hex: string; // e.g., "#6366f1"
  oklch: string; // e.g., "oklch(0.554 0.046 257.417)"
};

type ColorScale = ColorData[];

// Tailwind CSS standard 10-step scale indices
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

// A comprehensive, self-contained list of named colors for distance lookup,
// mapped from the provided ["HEX", "Name"] array format.

/**
 * Converts a color name (e.g., "Azure Radiance") to a CSS variable-friendly name (e.g., "azure-radiance").
 * @param name The human-readable color name.
 * @returns The CSS variable-friendly name.
 */
const toCssVarName = (name: string): string => {
  return name.toLowerCase().replace(/\s+/g, "-");
};

/**
 * Finds the closest matching color name from a dictionary using chroma-js's color distance.
 * We use the 'lab' space for a perceptually uniform distance calculation, which is better than RGB.
 * @param hex The HEX color string to name.
 * @returns The closest human-readable color name.
 */
const getClosestColorName = (hex: string): string => {
  try {
    let closestName = "Custom";
    let minDistance = Infinity;

    for (const namedColor of NAMED_COLORS) {
      // FIX: Use the static chroma.distance method
      const distance = chroma.distance(hex, namedColor.hex, "lab");

      if (distance < minDistance) {
        minDistance = distance;
        closestName = namedColor.name;
      }
    }
    return closestName;
  } catch (error) {
    console.error("Error in color naming:", error);
    return "Custom";
  }
};

const App = () => {
  const [baseColor, setBaseColor] = useState("#6366f1");
  const [colorScale, setColorScale] = useState<ColorScale>([]);
  const [baseColorName, setBaseColorName] = useState("Indigo");

  const [secondaryColor, setSecondaryColor] = useState("#f59e0b");
  const [showSecondary /*setShowSecondary*/] = useState(false);
  const [secondaryScale, setSecondaryScale] = useState<ColorScale>([]);
  const [secondaryColorName, setSecondaryColorName] = useState("Amber");

  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCode, setExportCode] = useState("");

  /**
   * Generates a 10-step color scale (50-900) from a base color.
   * @param color The base HEX color string.
   * @returns A ColorScale array of 10 objects.
   */
  const generateColorScale = (color: string): ColorScale => {
    try {
      // Adjusted ratios for a smoother 10-step scale (50-900)
      const mixRatios = [0.95, 0.8, 0.6, 0.4, 0.2, 0, 0.2, 0.4, 0.6, 0.8];
      const mixColors = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", color, "#000000", "#000000", "#000000", "#000000"];
      // FIX: Use 'as const' to resolve TypeScript error for mixModes array elements
      const mixModes = ["lch", "lch", "lch", "lch", "lch", "lch", "lch", "lch", "lch", "lch"] as const;

      // Ensure the base color is exactly the 500 step (index 5)
      const hexScale: string[] = mixRatios.map((ratio, index) => {
        if (index === 5) return color; // 500 is the exact base color

        // Use a mix towards white for lighter steps (0-4) and black for darker steps (6-9)
        const mixedColor = chroma.mix(mixColors[index], color, 1 - ratio, mixModes[index]);
        return mixedColor.hex();
      });

      return hexScale.map((hex) => {
        const oklchArray = chroma(hex).oklch();
        // Format L, C, H values with 3 decimals for the display state
        const oklchValue = oklchArray.map((v) => (isNaN(v) ? "0.000" : v.toFixed(3))).join(" ");

        return {
          hex,
          oklch: `oklch(${oklchValue})`,
        };
      });
    } catch (error) {
      console.error("Error generating color scale:", error);
      return [];
    }
  };

  /**
   * Generates a random HEX color and sets it as the new base color.
   */
  const generateRandomColor = () => {
    const randomColor = chroma.random().hex();
    setBaseColor(randomColor);
  };

  /**
   * Copies text to clipboard and shows a checkmark temporarily.
   * @param text The text to copy.
   */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedColor(text);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  /**
   * Generates the final Tailwind CSS v4 @theme block for export.
   */
  const handleExportCss = () => {
    const allCssVariables: string[] = [];

    /**
     * Helper to generate CSS variables for a scale.
     */
    const generateVariables = (scale: ColorScale, name: string) => {
      if (scale.length !== SCALE_STEPS.length) return; // Must be 10 steps

      const cssName = toCssVarName(name);

      scale.forEach((colorData, index) => {
        const step = SCALE_STEPS[index];

        // Re-calculate oklch for precise export formatting (3 decimal places)
        const [l, c, h] = chroma(colorData.hex).oklch();
        const formattedL = l.toFixed(3);
        const formattedC = c.toFixed(3);
        // Oklch hue (h) can be NaN for achromatic colors, so we check
        const formattedH = isNaN(h) ? "0.000" : h.toFixed(3);
        const oklchValue = `oklch(${formattedL} ${formattedC} ${formattedH})`;

        allCssVariables.push(`  --color-${cssName}-${step}: ${oklchValue};`);
      });
    };

    // Primary Color Scale
    if (colorScale.length === SCALE_STEPS.length) {
      generateVariables(colorScale, baseColorName);
    }

    // Secondary Color Scale
    if (showSecondary && secondaryScale.length === SCALE_STEPS.length) {
      generateVariables(secondaryScale, secondaryColorName);
    }

    const fullCss = `@theme {\n${allCssVariables.join("\n")}\n}`;
    setExportCode(fullCss);
    setShowExportModal(true);
  };

  // --- Effects ---

  // Handle spacebar for random generation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space" && event.target === document.body) {
        event.preventDefault();
        generateRandomColor();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Effect to update color scales when base or secondary colors change
  useEffect(() => {
    setColorScale(generateColorScale(baseColor));
  }, [baseColor]);

  useEffect(() => {
    if (showSecondary) {
      // Initialize secondary color if it's being shown for the first time
      const finalSecondaryColor = secondaryColor || "#f59e0b";
      setSecondaryColor(finalSecondaryColor);
      setSecondaryScale(generateColorScale(finalSecondaryColor));
    } else {
      setSecondaryScale([]);
    }
  }, [secondaryColor, showSecondary]);

  // Effect to update color names when colors change
  useEffect(() => {
    // The 500 step color (index 5) is the one used for the base color name
    if (colorScale.length > 5) {
      setBaseColorName(getClosestColorName(colorScale[5].hex));
    } else {
      setBaseColorName(getClosestColorName(baseColor));
    }
  }, [baseColor, colorScale]);

  useEffect(() => {
    if (showSecondary) {
      // If the scale is ready, use its 500 step. Otherwise, use the raw color.
      if (secondaryScale.length > 5) {
        setSecondaryColorName(getClosestColorName(secondaryScale[5].hex));
      } else if (secondaryColor) {
        setSecondaryColorName(getClosestColorName(secondaryColor));
      }
    } else {
      setSecondaryColorName("Secondary"); // Default name when hidden
    }
  }, [secondaryColor, secondaryScale, showSecondary]);

  // --- Render ---
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-cod-gray-950">
      {/* Export Modal */}
      {showExportModal && (
        <div
          tabIndex={-1} // Modal container handles focus trap logic if fully implemented, -1 is fine for simple overlay
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowExportModal(false)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="document">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Export Tailwind CSS v4 Theme</h2>
              <button
                onClick={() => setShowExportModal(false)}
                aria-label="Close export modal"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowExportModal(false)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-gray-700 mb-4 text-sm">Copy the following CSS and paste it into your Tailwind CSS configuration file to use your custom colors in Oklch format.</p>
              <div className="relative">
                <pre className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap max-h-96">{exportCode}</pre>
                <button
                  onClick={() => copyToClipboard(exportCode)}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-slate-900/70 hover:bg-slate-900 transition-colors text-white flex items-center gap-1 font-medium text-xs"
                  aria-label={copiedColor === exportCode ? "Copied" : "Copy CSS code"}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && copyToClipboard(exportCode)}
                >
                  <span className={`flex items-center gap-1 ${copiedColor === exportCode ? "text-green-300" : "text-white"}`}>
                    {copiedColor === exportCode ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header (omitted for brevity, no changes needed) */}
      {/* <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <Palette className="w-8 h-8 text-slate-900" />
                <span className="text-xl font-bold text-gray-900">Tintwind</span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-gray-900 hover:text-slate-900 font-medium">
                  Generate
                </a>
                <a href="#" className="text-gray-600 hover:text-slate-900">
                  My palettes
                </a>
                <a href="#" className="text-gray-600 hover:text-slate-900">
                  Tailwind Colors
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-slate-900" aria-label="Settings" tabIndex={0}>
                <Settings className="w-5 h-5" />
              </button>
              <button className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors font-medium">Sign in</button>
            </div>
          </div>
        </div>
      </header> */}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-0 py-12 flex flex-col justify-center items-center min-h-screen">
        {/* Hero Section */}
        <div className="text-left mb-2 flex justify-between px-2 w-full">
          <div className="mx-0">
            <h1 className="text-5xl font-semibold tracking-tight text-gray-900 mb-4 dark:text-gray-100">Tintwind</h1>
            <h2 className="text-base font-normal text-gray-500 mb-4">Tailwind 4 OKLCH Colour Scales Generator</h2>
            {/* <p className="text-base text-gray-600 mb-8">Instantly create Tailwind 4 OKLCH colour scales.</p> */}
          </div>

          <div className="flex flex-col items-center p-4 w-fit">
            {/* Color Input (omitted for brevity, no changes needed) */}
            <div className="flex items-center gap-4 mb-6 flex-wrap w-full justify-end">
              {/* Base Color Input */}
              <div className="relative border border-gray-200 hover:border-gray-200 bg-white items-left flex rounded-xl max-w-36 p-2">
                <div className="rounded-xl overflow-hidden p-0 bg-white w-full max-w-12">
                  <input
                    type="color"
                    value={baseColor}
                    onChange={(e) => setBaseColor(e.target.value)}
                    className="transition-colors bg-transparent p-2 w-12 h-12 overflow-hidden appearance-none absolute top-1/2 transform -translate-y-1/2 rounded-full border-none cursor-pointer"
                    aria-label="Base color picker"
                  />
                </div>
                <input
                  type="text"
                  value={baseColor}
                  onChange={(e) => setBaseColor(e.target.value)}
                  className="py-2 rounded-lg ml-1 font-normal w-full text-left bg-transparent focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  placeholder="#6366f1"
                  aria-label="Base color hex value"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateRandomColor}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && generateRandomColor()}
                  aria-label="Generate random color (Spacebar)"
                  className="flex items-center gap-2 text-zinc-600 border border-gray-200 hover:border-gray-200 px-4 py-4 rounded-lg hover:bg-gray-100 transition-colors font-medium bg-white"
                >
                  <Shuffle className="w-5 h-5" />
                  Generate random
                </button>
                <button
                  onClick={handleExportCss}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleExportCss()}
                  className="flex items-center gap-2 h-full max-h-14 bg-white border border-gray-200 hover:border-gray-200 text-zinc-600 px-6 py-4 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                  disabled={colorScale.length !== SCALE_STEPS.length}
                >
                  <Copy className="w-4 h-4" />
                  Export CSS
                </button>
              </div>
            </div>
            {/* Controls (omitted for brevity, no changes needed) */}
            {/**
             // *  TODO: Move secondary color controls from here */}

            <div className="flex items-end justify-end gap-6 flex-wrap w-full">
              {/* <button
                onClick={() => setShowSecondary(!showSecondary)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowSecondary(!showSecondary)}
                className="flex items-center gap-2 text-zinc-900 hover:text-zinc-950 font-medium transition-colors"
                aria-expanded={showSecondary}
                aria-controls="secondary-scale-controls"
              >
                <Plus className="w-4 h-4" />
                {showSecondary ? "Remove secondary color scale" : "Add secondary color scale"}
              </button> */}
              {/* <div className="flex items-center gap-2">
                <label htmlFor="color-scheme-select" className="text-sm text-gray-600">
                  Color combination scheme
                </label>
                <select id="color-scheme-select" className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                  <option>auto</option>
                  <option>Monochromatic</option>
                  <option>Analogous</option>
                  <option>Complementary</option>
                  <option>Triadic</option>
                </select>
              </div> */}
            </div>
          </div>
        </div>

        {/* Color Palette Display - UPDATED */}
        <div className="bg-white rounded-2xl shadow-sm mb-8 p-12 pt-4 w-full">
          <div className="flex items-center justify-between mb-6">
            {/* <h2 className="text-3xl font-medium text-gray-900">Palette</h2> */}
            <div className="flex gap-4">
              {/* <button
                onClick={handleExportCss}
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleExportCss()}
                className="flex items-center gap-2 h-full max-h-14 bg-white border border-zinc-400 text-gray-800 px-6 py-4 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                disabled={colorScale.length !== SCALE_STEPS.length}
              >
                <Copy className="w-4 h-4" />
                Export CSS
              </button> */}
              {/* <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors font-medium">
                <Save className="w-4 h-4" />
                Save palette
              </button> */}
            </div>
          </div>

          {/* Main Color Scale */}
          <h3 className="text-3xl font-semibold text-gray-400 mb-4">
            <span className="text-slate-700">{baseColorName}</span>
          </h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-3 mb-8">
            {colorScale.map((colorData, index) => (
              <div key={index} className="group">
                {/* Scale steps */}
                <div className="text-base text-gray-500 mt-1 text-center mb-2">{SCALE_STEPS[index]}</div>
                <div
                  className="aspect-square rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 group-hover:scale-100 transform border border-gray-200 relative"
                  style={{ backgroundColor: colorData.hex }}
                  onClick={() => copyToClipboard(colorData.hex)}
                  title={`Click to copy ${colorData.hex}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Copy primary color ${SCALE_STEPS[index]} (${colorData.hex})`}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && copyToClipboard(colorData.hex)}
                >
                  <div
                    className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl transition-opacity duration-200 ${
                      copiedColor === colorData.hex ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <Check className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="text-center mt-3">
                  {/* Color HEX */}
                  <div className="text-base font-mono text-gray-700 font-medium">{colorData.hex.toUpperCase()}</div>
                  {/* Color OKLCH */}
                  {/* <div className="text-[10px] text-gray-400 mt-1 truncate" title={colorData.oklch}>
                    {colorData.oklch}
                  </div> */}
                </div>
              </div>
            ))}
          </div>

          {/* Secondary Color Scale - UPDATED */}
          {showSecondary && (
            <div>
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Secondary Scale: <span className="text-slate-900">{secondaryColorName}</span>
              </h3>
              <div id="secondary-scale-controls" className="flex items-start gap-4 mb-6">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer hover:border-gray-400 transition-colors"
                  aria-label="Secondary color picker"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg font-mono text-left w-32 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="#f59e0b"
                  aria-label="Secondary color hex value"
                />
                <span className="text-gray-700 font-medium">Secondary Color</span>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                {secondaryScale.map((colorData, index) => (
                  <div key={index} className="group">
                    <div
                      className="aspect-square rounded-xl cursor-pointer shadow-md hover:shadow-xl transition-all duration-200 group-hover:scale-105 transform border border-gray-200 relative"
                      style={{ backgroundColor: colorData.hex }}
                      onClick={() => copyToClipboard(colorData.hex)}
                      title={`Click to copy ${colorData.hex}`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Copy secondary color ${SCALE_STEPS[index]} (${colorData.hex})`}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && copyToClipboard(colorData.hex)}
                    >
                      <div
                        className={`absolute inset-0 flex items-start justify-center bg-black/50 rounded-xl transition-opacity duration-200 ${
                          copiedColor === colorData.hex ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="text-left mt-3">
                      <div className="text-xs font-mono text-gray-700 font-medium">{colorData.hex.toUpperCase()}</div>
                      <div className="text-xs text-gray-500 mt-1">{SCALE_STEPS[index]}</div>
                      {/* <div className="text-[10px] text-gray-400 mt-1 truncate" title={colorData.oklch}>
                        {colorData.oklch.split("(")[1]?.split(" ")[0]}
                      </div> */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer (omitted for brevity, no changes needed) */}
      {/* <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <span>Feedback</span>
              <a href="#" className="hover:text-slate-900 transition-colors">
                @erikdevries_nl
              </a>
              <a href="#" className="hover:text-slate-900 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-slate-900 transition-colors">
                API
              </a>
              <a href="#" className="hover:text-slate-900 transition-colors">
                Tailwind Colors
              </a>
            </div>
            <div className="text-sm text-gray-500">Made with ❤️ for designers and developers</div>
          </div>
        </div>
      </footer> */}
    </main>
  );
};

export default App;
