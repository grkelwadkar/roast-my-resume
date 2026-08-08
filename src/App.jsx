import React, { useState, useRef } from "react";
import {
  Stamp,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  PenLine,
  Upload,
  FileText,
  X,
} from "lucide-react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PALETTE = {
  paper: "#EDE6D6",
  paperShadow: "#D8CBAE",
  paperDark: "#DED4BC",
  ink: "#211B14",
  inkFaint: "#6B6252",
  redPen: "#C4223A",
  redPenSoft: "#C4223A22",
  bluePen: "#2B4C7E",
  bluePenSoft: "#2B4C7E1a",
  gold: "#A9781F",
  cream: "#F6F1E4",
};

function Watermark() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 27px, #00000006 28px)",
      }}
    />
  );
}

function PaperShell({ children, rotate = 0 }) {
  return (
    <div
      className="relative w-full max-w-2xl mx-auto"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: PALETTE.paperDark,
          transform: "translate(6px, 8px) rotate(-0.6deg)",
          borderRadius: "2px",
        }}
      />
      <div
        className="relative px-6 py-8 sm:px-10 sm:py-10"
        style={{
          background: PALETTE.paper,
          borderRadius: "2px",
          boxShadow:
            "0 1px 0 rgba(0,0,0,0.05), 0 12px 24px -12px rgba(33,27,20,0.35)",
        }}
      >
        <Watermark />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function Stamp_({ label, tone = "red" }) {
  const color = tone === "red" ? PALETTE.redPen : PALETTE.bluePen;
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-1.5 border-2 rounded"
      style={{
        borderColor: color,
        color: color,
        transform: "rotate(-4deg)",
        fontFamily: "'Anton', sans-serif",
        letterSpacing: "0.06em",
        opacity: 0.9,
      }}
    >
      <Stamp size={16} strokeWidth={2.5} />
      <span style={{ fontSize: "0.85rem" }}>{label}</span>
    </div>
  );
}

const PLACEHOLDER = `Paste your resume text here.

Example:
GAURAV SHARMA
Tech Lead — Telecom BSS

EXPERIENCE
Tech Mahindra, Pune | 2019 - Present
- Responsible for product catalog and ordering systems
- Worked with TMForum standards
- Handled client communication

...paste the real thing. Full text, not a summary. The more real it is, the better the roast.`;

export default function App() {
  const [stage, setStage] = useState("intake"); // intake | loading | result | error
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const cardRef = useRef(null);
  const fileInputRef = useRef(null);

  const wordCount = resumeText.trim().length
    ? resumeText.trim().split(/\s+/).length
    : 0;
  const canSubmit = wordCount >= 30;

  async function handleFile(file) {
    if (!file) return;
    setParseError("");
    const ext = file.name.split(".").pop().toLowerCase();

    if (!["txt", "docx", "pdf"].includes(ext)) {
      setParseError("Use a .txt, .docx, or .pdf file.");
      return;
    }

    setIsParsing(true);
    setFileName(file.name);

    try {
      if (ext === "txt") {
        const text = await file.text();
        setResumeText(text);
      } else if (ext === "docx") {
        const arrayBuffer = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer });
        setResumeText(value);
      } else if (ext === "pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item) => item.str).join(" ") + "\n";
        }
        setResumeText(fullText.trim());
      }
    } catch (err) {
      console.error("File parse failed:", err);
      setParseError("Couldn't read that file. Try pasting the text instead.");
      setFileName("");
    } finally {
      setIsParsing(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  async function handleRoast() {
    if (!canSubmit) return;
    setStage("loading");
    setSubmitError("");
    try {
      const response = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      const parsed = await response.json();
      if (!response.ok) {
        throw new Error(parsed.error || "Request failed");
      }
      setResult(parsed);
      setStage("result");
    } catch (err) {
      console.error("Roast failed:", err);
      setSubmitError(err.message);
      setStage("error");
    }
  }

  function reset() {
    setStage("intake");
    setResult(null);
    setCopied(false);
    setFileName("");
    setParseError("");
    setSubmitError("");
  }

  function copyShareText() {
    if (!result) return;
    const text = `I got roasted by RedPen 🖊️\n\nScore: ${result.score}/100 — "${result.verdict}"\n\n"${result.roastLines[0]}"\n\nThink you'd score higher? Roast your resume too.`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const scoreColor =
    result && result.score >= 70
      ? PALETTE.bluePen
      : result && result.score >= 40
      ? PALETTE.gold
      : PALETTE.redPen;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center py-10 px-4"
      style={{
        background:
          "radial-gradient(ellipse at top, #F6F1E4 0%, #E4DAC4 55%, #D3C6A8 100%)",
        fontFamily: "'Courier Prime', monospace",
        color: PALETTE.ink,
      }}
    >
      {/* Header */}
      <div className="w-full max-w-2xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenLine size={22} color={PALETTE.redPen} strokeWidth={2.5} />
          <span
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: "1.4rem",
              letterSpacing: "0.02em",
            }}
          >
            RED<span style={{ color: PALETTE.redPen }}>PEN</span>
          </span>
        </div>
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: PALETTE.inkFaint }}
        >
          Resume grading, brutally honest
        </span>
      </div>

      {/* INTAKE */}
      {stage === "intake" && (
        <PaperShell>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1
                style={{
                  fontFamily: "'Anton', sans-serif",
                  fontSize: "1.9rem",
                  lineHeight: 1.05,
                }}
              >
                Hand it in.
              </h1>
              <p className="mt-2 text-sm" style={{ color: PALETTE.inkFaint }}>
                Upload or paste your resume. Full sections, not a summary.
                You'll get a score, three margin notes, and one real fix.
              </p>
            </div>
            <div style={{ transform: "rotate(6deg)" }}>
              <Stamp_ label="INTAKE" tone="blue" />
            </div>
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-6 mb-3 cursor-pointer transition-colors"
            style={{
              border: `2px dashed ${
                isDragging ? PALETTE.redPen : PALETTE.paperShadow
              }`,
              borderRadius: "2px",
              background: isDragging ? PALETTE.redPenSoft : "transparent",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx,.pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {isParsing ? (
              <span className="text-sm" style={{ color: PALETTE.inkFaint }}>
                Reading file...
              </span>
            ) : fileName ? (
              <div className="flex items-center gap-2">
                <FileText size={16} color={PALETTE.bluePen} />
                <span className="text-sm">{fileName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileName("");
                    setResumeText("");
                  }}
                  className="ml-1"
                >
                  <X size={14} color={PALETTE.inkFaint} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={20} color={PALETTE.inkFaint} />
                <span className="text-sm" style={{ color: PALETTE.inkFaint }}>
                  Drop your resume here, or click to upload (.txt, .docx, .pdf)
                </span>
              </>
            )}
          </div>

          {parseError && (
            <p
              className="text-xs mb-3"
              style={{
                color: PALETTE.redPen,
                fontFamily: "'Caveat', cursive",
                fontSize: "1.05rem",
              }}
            >
              {parseError}
            </p>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div
              style={{ flex: 1, borderTop: `1px dashed ${PALETTE.paperShadow}` }}
            />
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: PALETTE.inkFaint }}
            >
              or paste
            </span>
            <div
              style={{ flex: 1, borderTop: `1px dashed ${PALETTE.paperShadow}` }}
            />
          </div>

          <textarea
            value={resumeText}
            onChange={(e) => {
              setResumeText(e.target.value);
              if (fileName) setFileName("");
            }}
            placeholder={PLACEHOLDER}
            rows={11}
            className="w-full p-4 text-sm resize-none focus:outline-none"
            style={{
              background: PALETTE.cream,
              border: `1.5px solid ${PALETTE.paperShadow}`,
              borderRadius: "2px",
              fontFamily: "'Courier Prime', monospace",
              color: PALETTE.ink,
              boxShadow: "inset 0 1px 3px rgba(33,27,20,0.08)",
            }}
          />

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs" style={{ color: PALETTE.inkFaint }}>
              {wordCount} words {canSubmit ? "" : "· need at least 30 to grade"}
            </span>
            <button
              onClick={handleRoast}
              disabled={!canSubmit}
              className="px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-transform active:scale-95"
              style={{
                background: canSubmit ? PALETTE.ink : PALETTE.paperShadow,
                color: canSubmit ? PALETTE.paper : PALETTE.inkFaint,
                borderRadius: "2px",
                cursor: canSubmit ? "pointer" : "not-allowed",
                fontFamily: "'Anton', sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              Grade Me
            </button>
          </div>
        </PaperShell>
      )}

      {/* LOADING */}
      {stage === "loading" && (
        <PaperShell rotate={-1}>
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div style={{ animation: "spin 1.4s linear infinite" }}>
              <Stamp size={40} color={PALETTE.redPen} strokeWidth={2} />
            </div>
            <p
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "1.5rem",
                color: PALETTE.redPen,
              }}
            >
              reading every buzzword twice...
            </p>
          </div>
        </PaperShell>
      )}

      {/* ERROR */}
      {stage === "error" && (
        <PaperShell rotate={1}>
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <AlertTriangle size={32} color={PALETTE.redPen} />
            <p className="font-bold">The grading pen ran out of ink.</p>
            <p className="text-sm" style={{ color: PALETTE.inkFaint }}>
              {submitError ||
                "Something went wrong reaching the model. Try again."}
            </p>
            <button
              onClick={reset}
              className="mt-2 px-4 py-2 text-sm font-bold uppercase"
              style={{
                background: PALETTE.ink,
                color: PALETTE.paper,
                borderRadius: "2px",
                fontFamily: "'Anton', sans-serif",
              }}
            >
              Try Again
            </button>
          </div>
        </PaperShell>
      )}

      {/* RESULT */}
      {stage === "result" && result && (
        <div className="w-full flex flex-col items-center gap-6">
          <div ref={cardRef} className="w-full">
            <PaperShell rotate={-0.5}>
              <div className="flex justify-center mb-2">
                <div
                  style={{
                    transform: "rotate(-8deg)",
                    border: `4px solid ${scoreColor}`,
                    color: scoreColor,
                    borderRadius: "6px",
                    padding: "0.6rem 1.4rem",
                    textAlign: "center",
                    opacity: 0.92,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Anton', sans-serif",
                      fontSize: "3rem",
                      lineHeight: 1,
                    }}
                  >
                    {result.score}
                    <span style={{ fontSize: "1.2rem" }}>/100</span>
                  </div>
                  <div
                    className="uppercase tracking-widest"
                    style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}
                  >
                    {result.verdict}
                  </div>
                </div>
              </div>

              <div className="text-center mb-6">
                <span className="text-xs" style={{ color: PALETTE.inkFaint }}>
                  graded by RedPen
                </span>
              </div>

              <div className="space-y-3 mb-6">
                {result.roastLines.map((line, i) => (
                  <div
                    key={i}
                    className="flex gap-3 items-start"
                    style={{
                      transform: `rotate(${i % 2 === 0 ? -0.4 : 0.4}deg)`,
                    }}
                  >
                    <PenLine
                      size={16}
                      color={PALETTE.redPen}
                      style={{ marginTop: "0.3rem", flexShrink: 0 }}
                    />
                    <p
                      style={{
                        fontFamily: "'Caveat', cursive",
                        fontSize: "1.35rem",
                        color: PALETTE.redPen,
                        lineHeight: 1.25,
                      }}
                    >
                      {line}
                    </p>
                  </div>
                ))}
              </div>

              <div
                style={{ borderTop: `1px dashed ${PALETTE.paperShadow}` }}
                className="my-5"
              />

              <div className="mb-4">
                <span
                  className="text-xs uppercase tracking-widest font-bold"
                  style={{ color: PALETTE.redPen }}
                >
                  Biggest problem
                </span>
                <p className="text-sm mt-1">{result.redFlag}</p>
              </div>

              <div className="mb-4">
                <span
                  className="text-xs uppercase tracking-widest font-bold"
                  style={{ color: PALETTE.gold }}
                >
                  Actually good
                </span>
                <p className="text-sm mt-1">{result.strength}</p>
              </div>

              <div
                className="p-4 mt-5"
                style={{
                  background: PALETTE.bluePenSoft,
                  borderLeft: `3px solid ${PALETTE.bluePen}`,
                  borderRadius: "2px",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} color={PALETTE.bluePen} />
                  <span
                    className="text-xs uppercase tracking-widest font-bold"
                    style={{ color: PALETTE.bluePen }}
                  >
                    The fix
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: "1.3rem",
                    color: PALETTE.bluePen,
                    lineHeight: 1.25,
                  }}
                >
                  {result.fix}
                </p>
              </div>
            </PaperShell>
          </div>

          <div className="flex flex-wrap gap-3 justify-center max-w-2xl w-full">
            <button
              onClick={copyShareText}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold uppercase"
              style={{
                background: PALETTE.ink,
                color: PALETTE.paper,
                borderRadius: "2px",
                fontFamily: "'Anton', sans-serif",
                letterSpacing: "0.03em",
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy Share Text"}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold uppercase"
              style={{
                background: "transparent",
                color: PALETTE.ink,
                border: `1.5px solid ${PALETTE.ink}`,
                borderRadius: "2px",
                fontFamily: "'Anton', sans-serif",
                letterSpacing: "0.03em",
              }}
            >
              <RotateCcw size={16} />
              Roast Another
            </button>
          </div>

          <p
            className="text-xs text-center max-w-md"
            style={{ color: PALETTE.inkFaint }}
          >
            Screenshot the card above to share. Full rewrite suggestions coming soon.
          </p>
        </div>
      )}

      <footer className="w-full max-w-2xl mx-auto mt-8 text-center text-xs" style={{ color: PALETTE.inkFaint }}>
        Created by Gaurav Kelwadkar.
        <br />
        <a href="https://www.linkedin.com/in/gaurav-kelwadkar-aa891759/" target="_blank" rel="noreferrer" style={{ color: PALETTE.inkFaint, textDecoration: "underline" }}>
          https://www.linkedin.com/in/gaurav-kelwadkar-aa891759/
        </a>
      </footer>
    </div>
  );
}
