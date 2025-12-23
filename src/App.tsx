import chroma from "chroma-js";
import { Check, Copy, Shuffle, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  const [inputValue, setInputValue] = useState("#6366f1");
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCode, setExportCode] = useState("");

  const deferredBaseColor = useDeferredValue(baseColor);

  // 2. Update the input value and attempt to update the base color if valid
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;

    // Ensure it starts with # for consistency
    const formattedValue = nextValue.startsWith("#") ? nextValue : `#${nextValue}`;
    setInputValue(formattedValue);

    // 3. Validation Check: Only update the generator if it's a valid chroma color
    if (chroma.valid(formattedValue)) {
      setBaseColor(chroma(formattedValue).hex());
    }
    // If invalid (like #6366f), we do nothing. No error, no update.
  };

  // 4. Sync inputValue when the color picker (the <input type="color">) is used
  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setBaseColor(newColor);
    setInputValue(newColor);
  };

  /**
   * Generates a 10-step color scale (50-900) from a base color.
   * @param color The base HEX color string.
   * @returns A ColorScale array of 10 objects.
   */
  const generateColorScale = (color: string): ColorScale => {
    try {
      // Adjusted ratios for a smoother 10-step scale (50-900)
      const mixRatios = [0.95, 0.8, 0.6, 0.4, 0.2, 0, 0.2, 0.4, 0.6, 0.8];
      const mixColors = [
        "#ffffff",
        "#ffffff",
        "#ffffff",
        "#ffffff",
        "#ffffff",
        color,
        "#000000",
        "#000000",
        "#000000",
        "#000000",
      ];
      // FIX: Use 'as const' to resolve TypeScript error for mixModes array elements
      const mixModes = [
        "lch",
        "lch",
        "lch",
        "lch",
        "lch",
        "lch",
        "lch",
        "lch",
        "lch",
        "lch",
      ] as const;

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

  const colorScale = useMemo(() => {
    return generateColorScale(deferredBaseColor);
  }, [deferredBaseColor]);

  const baseColorName = useMemo(() => {
    // Optimization: Use the 500 step if scale exists, otherwise use raw color
    const hexToName = colorScale.length > 5 ? colorScale[5].hex : deferredBaseColor;
    return getClosestColorName(hexToName);
  }, [deferredBaseColor, colorScale]);

  /**
   * Generates a random HEX color and sets it as the new base color.
   */
  const generateRandomColor = () => {
    const randomColor = chroma.random().hex();
    setBaseColor(randomColor);
    setInputValue(randomColor);
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
    // if (showSecondary && secondaryScale.length === SCALE_STEPS.length) {
    //   generateVariables(secondaryScale, secondaryColorName);
    // }

    // const fullCss = `@theme {\n${allCssVariables.join("\n")}\n}`;
    const fullCss = `${allCssVariables.join("\n")}\n`;
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

  console.log("baseColor", deferredBaseColor);

  // --- Render ---
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-cod-gray-500">
      <div
        className={`absolute top-0 left-0 w-full h-full z-10 opacity-5`}
        style={{
          backgroundImage: `linear-gradient(to bottom, #090909, ${deferredBaseColor})`,
        }}
      ></div>
      {/* Main Content */}
      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center items-center min-h-screen z-40 relative">
        {/* Header Section */}
        <header className="text-left mb-2 flex flex-col lg:flex-row justify-between px-2 w-full">
          <div className="mx-0">
            <h1 className="text-5xl font-semibold tracking-tight text-gray-900 mb-4 dark:text-gray-100 baloo-2">
              Tintwind
            </h1>
            <h2 className="text-base font-normal text-gray-500 mb-4 dark:text-bunker-100">
              Tailwind 4 OKLCH Color Palette Generator
            </h2>
          </div>

          {/* Header Buttons */}
          <div className="flex flex-col items-center md:pt-2 lg:p-4 pr-0 w-full md:w-fit">
            {/* Color Input */}
            <div className="flex flex-col md:flex-row items-center gap-3 mb-6 lg:flex-wrap w-full lg:justify-end">
              {/* Base Color Input */}
              <div className="relative border border-gray-200 hover:border-gray-200 dark:border-woodsmoke-400/50 bg-white items-left flex rounded-xl md:max-w-36 p-2 dark:bg-woodsmoke-600 dark:hover:border-woodsmoke-400 transition-colors duration-150 ease-in w-full">
                <div className="rounded-sm overflow-hidden p-0 bg-white max-w-none w-fit min-w-10 dark:bg-transparent flex justify-center items-center">
                  <input
                    type="color"
                    id="baseColorPicker"
                    value={baseColor}
                    // onChange={handleBaseColorChange}
                    onChange={handlePickerChange}
                    className="bg-transparent p-0 w-8 h-8 flex min-w-fit appearance-none border-none cursor-pointer rounded-xl"
                    aria-label="Base color picker"
                    title="Base color picker"
                  />
                </div>
                <input
                  id="baseColorHex"
                  type="text"
                  value={inputValue} // Bind to the "dirty" value
                  onChange={handleTextChange}
                  className="py-2 rounded-lg pl-1 font-normal w-full text-left bg-transparent focus:ring-0 focus:border-none outline-hidden transition-colors dark:text-shark-100 text-lg font-mono"
                  placeholder="#6366f1"
                  aria-label="Base color hex value"
                />
              </div>
              {/* Generate Random & Export CSS Buttons */}
              <div className="flex flex-col md:flex-row w-full md:w-fit md:items-center gap-2">
                <button
                  onClick={generateRandomColor}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && generateRandomColor()}
                  aria-label="Generate random color (Spacebar)"
                  className="cursor-pointer items-center gap-2 text-zinc-600 border border-gray-200 hover:border-gray-200 px-4 py-4 font-medium dark:border-mercury-900 bg-white items-left flex flex-row rounded-xl p-2 dark:bg-mercury-500 dark:hover:border-mercury-800 transition-colors duration-100 ease-in dark:text-shark-800 dark:hover:bg-mercury-300"
                >
                  <Shuffle className="w-5 h-5" />
                  Generate random
                </button>
                <button
                  onClick={handleExportCss}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleExportCss()}
                  className="cursor-pointer items-center gap-2 text-zinc-600 border border-gray-200 hover:border-gray-200 px-4 py-4 font-medium dark:border-mercury-900 bg-white items-left flex flex-row rounded-xl p-2 dark:bg-mercury-500 dark:hover:border-mercury-800 transition-colors duration-100 ease-in dark:text-shark-800 dark:hover:bg-mercury-300"
                  disabled={colorScale.length !== SCALE_STEPS.length}
                >
                  <Copy className="w-4 h-4" />
                  Export CSS
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Color Palette Display Card */}
        <div className="bg-white dark:bg-cod-gray-500 border dark:border-woodsmoke-400/50 rounded-2xl shadow-xs mb-8 p-10 md:p-8 pt-12 pb-10 w-full">
          {/* Main Color Scale */}
          <h3 className="text-3xl font-semibold text-gray-400 mb-6">
            <span className="text-slate-700 dark:text-white baloo-2 text-3xl">{baseColorName}</span>
          </h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-3 mb-8">
            {colorScale.map((colorData, index) => (
              <div key={index} className="group">
                {/* Scale steps */}
                <div className="text-base text-gray-500 dark:text-slate-100 mt-1 text-center mb-2">
                  {SCALE_STEPS[index]}
                </div>
                <div
                  className={`aspect-square text-white rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 group-hover:scale-100 transform border relative`}
                  style={{ backgroundColor: colorData.hex, borderColor: colorData.hex }}
                  onClick={() => copyToClipboard(colorData.hex)}
                  title={`Click to copy ${colorData.hex}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Copy primary color ${SCALE_STEPS[index]} (${colorData.hex})`}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && copyToClipboard(colorData.hex)
                  }
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
                  <div className="text-base font-mono text-gray-700 text-center justify-center dark:text-bunker-100 font-medium hidden lg:flex">
                    {colorData.hex.toUpperCase()}
                  </div>
                  {/* Color OKLCH */}
                  {/* <div className="text-[10px] text-gray-400 mt-1 truncate" title={colorData.oklch}>
                    {colorData.oklch}
                  </div> */}
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>

      {/* Export Modal */}
      {showExportModal && (
        <div
          tabIndex={-1} // Modal container handles focus trap logic if fully implemented, -1 is fine for simple overlay
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 z-50 bg-bunker-400/75 dark:bg-cod-gray-700/85 dark:grayscale flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-shark-500 lg:p-3"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 pb-0">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 baloo-2">
                Export {baseColorName} OKLCH Colors
              </h2>
              <button
                onClick={() => setShowExportModal(false)}
                aria-label="Close export modal"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowExportModal(false)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 ">
              <p className="text-gray-700 mb-6 text-sm dark:text-black-pearl-50 text-pretty">
                Add your custom <span className="lowercase">{baseColorName}</span> colors under the{" "}
                <code className="font-mono">@theme</code> directive in your stylesheet.
              </p>
              <div className="relative">
                <pre className="bg-gray-900 dark:bg-bunker-900/45 text-cod-gray-100 p-6 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap max-h-96">
                  {exportCode}
                </pre>
                <button
                  onClick={() => copyToClipboard(exportCode)}
                  className="absolute top-4 right-5 p-2 rounded-lg bg-transparent transition-colors text-white flex items-center gap-2 font-medium text-xs dark:hover:bg-cod-gray-400 cursor-pointer"
                  aria-label={copiedColor === exportCode ? "Copied" : "Copy CSS code"}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && copyToClipboard(exportCode)
                  }
                >
                  <span
                    className={`flex items-center gap-2 ${
                      copiedColor === exportCode ? "text-green-300" : "text-white"
                    }`}
                  >
                    {copiedColor === exportCode ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span className="sr-only">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="sr-only">Copy</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default App;
