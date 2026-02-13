import { useState, useEffect } from "react";
import constants, { buildPresenceChecklist } from "../constants.js";

import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function App() {
  const [aiReady, setAiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [presenceChecklist, setPresenceChecklist] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.puter?.ai?.chat) {
        setAiReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const extractPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, i) => {
        const page = await pdf.getPage(i + 1);
        const tc = await page.getTextContent();
        return tc.items.map((item) => item.str).join(" ");
      }),
    );
    return texts.join("\n").trim();
  };

  const parseJSONResponse = (reply) => {
    try {
      const match = reply.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found");

      const parsed = JSON.parse(match[0]);

      if (!parsed.overallScore && !parsed.error) {
        throw new Error("Missing overallScore");
      }

      const numericScore = Number(
        String(parsed.overallScore).match(/\d+(\.\d+)?/)?.[0],
      );

      if (Number.isNaN(numericScore)) {
        throw new Error("Invalid score format");
      }

      return {
        ...parsed,
        overallScore: numericScore,
      };
    } catch (err) {
      console.error("Parse error:", err);
      return { overallScore: null, error: "Invalid AI response format" };
    }
  };

  const analyzeResume = async (text) => {
    const prompt = constants.ANALYZE_RESUME_PROMPT.replace(
      "{{DOCUMENT_TEXT}}",
      text,
    );

    const response = await window.puter.ai.chat(
      [
        { role: "system", content: "You are an expert resume reviewer." },
        { role: "user", content: prompt },
      ],
      { model: "gpt-4o" },
    );

    const content =
      typeof response === "string"
        ? response
        : response?.message?.content || "";

    console.log("Raw AI response:", content);

    return parseJSONResponse(content);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
      return;
    }

    setUploadedFile(file);
    setIsLoading(true);
    setAnalysis(null);
    setResumeText("");
    setPresenceChecklist([]);
    setErrorMessage("");

    try {
      const text = await extractPDF(file);
      setResumeText(text);
      setPresenceChecklist(buildPresenceChecklist(text));

      const result = await analyzeResume(text);

      if (result.error) {
        setErrorMessage(result.error);
      }

      setAnalysis(result);
      console.log("Final analysis state:", result);
    } catch (err) {
      console.error("Analysis failed:", err);
      setErrorMessage(err.message || "Failed to analyze resume");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAnalysis = () => {
    setUploadedFile(null);
    setAnalysis(null);
    setResumeText("");
    setPresenceChecklist([]);
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-main-gradient p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto mb-10 text-center">
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 bg-clip-text text-transparent mb-4">
            AI RESUME ANALYZER
          </h1>
          <p className="text-slate-300 text-sm sm:text-base">
            Upload your PDF Resume and get instant AI Feedback
          </p>
        </div>

        {!uploadedFile && (
          <div className="upload-area">
            <div className="upload-zone">
              <h3 className="text-xl sm:text-2xl text-slate-200 mb-2">
                Upload Your Resume
              </h3>
              <p className="text-slate-400 mb-6 text-sm sm:text-base">
                PDF files only • Max 5MB recommended
              </p>

              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={!aiReady || isLoading}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`inline-block btn-primary ${
                  !aiReady || isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isLoading ? "Processing..." : "Choose PDF file"}
              </label>

              {!aiReady && (
                <p className="text-amber-300 mt-4 text-sm">
                  Waiting for AI engine to initialize...
                </p>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="p-8 max-w-md mx-auto">
            <div className="text-center">
              <div className="loading-spinner mx-auto mb-4"></div>
              <h3 className="text-xl text-slate-200 mb-2">
                Analyzing Your Resume
              </h3>
              <p className="text-slate-400">
                This usually takes 10–25 seconds...
              </p>
            </div>
          </div>
        )}

        {uploadedFile && !isLoading && (
          <div className="space-y-6 p-4 sm:px-8 lg:px-16">
            <div className="file-info-card">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="icon-container-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
                  <span className="text-3xl">📄</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-green-400">
                    Analysis Completed
                  </h3>
                  <p className="text-slate-300 text-sm break-all">
                    {uploadedFile.name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-5">
                <button onClick={resetAnalysis} className="btn-secondary">
                  Upload New Resume
                </button>
              </div>

              {analysis ? (
                analysis.overallScore !== null ? (
                  <div className="score-card mt-6">
                    <div className="text-center">
                      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                        Overall Score
                      </h2>
                      <p className="text-7xl sm:text-9xl font-extrabold text-cyan-400 drop-shadow-lg">
                        {analysis.overallScore}
                      </p>

                      <div
                        className={`inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-full text-lg font-semibold ${
                          analysis.overallScore >= 8
                            ? "score-status-excellent"
                            : analysis.overallScore >= 6
                              ? "score-status-good"
                              : "score-status-improvement"
                        }`}
                      >
                        <span>
                          {analysis.overallScore >= 8
                            ? "🌟 Excellent"
                            : analysis.overallScore >= 6
                              ? "⭐ Good"
                              : "📈 Needs Improvement"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 p-6 bg-red-900/30 border border-red-500/40 rounded-xl text-center">
                    <h3 className="text-xl text-red-300 mb-2">
                      Analysis Issue
                    </h3>
                    <p className="text-slate-300">
                      {analysis.error ||
                        "Could not extract a valid score from AI response."}
                    </p>
                    <p className="text-slate-400 text-sm mt-3">
                      Please try again or check the console for details.
                    </p>
                  </div>
                )
              ) : (
                <div className="mt-6 p-6 text-center text-amber-300">
                  No analysis result received. Please try again.
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 p-4 bg-red-900/40 rounded-lg text-red-200 text-center">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
