import { useState, useEffect } from "react";
import constants, {
  buildPresenceChecklist,
  METRIC_CONFIG,
} from "../constants.js";

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
    <div className="min-h-screen bg-[#ffc9d0]/85 font-poppins p-6">
      <div className="max-w-5xl mx-auto mb-10 text-center">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[#ff376e] mb-6">
          AI RESUME ANALYZER
        </h1>

        {!uploadedFile && (
          <div style={{ boxShadow: "0 4px 15px rgba(255, 55, 110, 0.4)" }}>
            <div className="upload-zone bg-[#ffc9d0]/85">
              <h3 className="text-2xl text-[#ca004c] mb-2">
                Upload Your Resume
              </h3>
              <p className="text-[#8b0032] mb-6">
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
                className={`inline-block w-full sm:w-auto px-6 py-4 rounded-2xl border-4 border-[#FF8DA1] text-[#ff376e] font-semibold text-lg cursor-pointer transition-all hover:bg-[#FF8DA1]/20 ${
                  !aiReady || isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isLoading ? "Processing..." : "Choose PDF file or Drag & Drop"}
              </label>

              {!aiReady && (
                <p className="text-[#ca004c] mt-4 text-sm">
                  Waiting for AI engine to initialize...
                </p>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="p-8 max-w-md mx-auto text-center">
            <div className="loading-spinner mx-auto mb-4"></div>
            <h3 className="text-xl text-[#ff376e] mb-2">
              Analyzing Your Resume
            </h3>
            <p className="text-[#8b0032]">
              This usually takes 10–25 seconds...
            </p>
          </div>
        )}

        {uploadedFile && !isLoading && (
          <div className="space-y-6 p-4 sm:px-8 lg:px-16">
            <div className="file-info-card bg-[#FF8DA1]/85 p-6 rounded-2xl shadow-md text-white">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="icon-container-xl bg-[#ff376e]/60 p-4 rounded-xl">
                  <span className="text-3xl">📄</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">
                    Analysis Completed
                  </h3>
                  <p className="text-white text-sm break-all">
                    {uploadedFile.name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={resetAnalysis}
                  className="px-6 py-3 bg-[#ca004c]/85 rounded-xl font-semibold hover:bg-[#ca004c]/100 transition"
                >
                  Upload New Resume
                </button>
              </div>

              {analysis ? (
                analysis.overallScore !== null ? (
                  <div className="score-card mt-6 p-6 rounded-3xl bg-[#ff376e]/85 shadow-lg text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                      Overall Score
                    </h2>
                    <p className="text-7xl sm:text-9xl font-extrabold text-[#ffc9d0] drop-shadow-lg">
                      {analysis.overallScore}
                    </p>

                    <div
                      className={`inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-full text-lg font-semibold ${
                        analysis.overallScore >= 8
                          ? "bg-[#FF8DA1]/85"
                          : analysis.overallScore >= 6
                            ? "bg-[#ff376e]/85"
                            : "bg-[#ca004c]/85"
                      } text-white`}
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
                ) : (
                  <div className="mt-6 p-6 bg-[#8b0032]/40 rounded-xl text-center text-white">
                    <h3 className="text-xl mb-2">Analysis Issues</h3>
                    <p>
                      {analysis.error || "Could not extract a valid score."}
                    </p>
                  </div>
                )
              ) : (
                <div className="mt-6 p-6 text-center text-[#ca004c]">
                  No analysis result received. Please try again.
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 p-4 bg-[#8b0032]/40 rounded-lg text-center text-white">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {analysis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {METRIC_CONFIG.map((metric) => (
              <div
                key={metric.key}
                className={`p-5 rounded-2xl flex items-center gap-4 shadow-md text-white bg-[#ff376e]/85 shadow-lg`}
              >
                <span className="text-3xl">{metric.icon}</span>
                <div>
                  <h4 className="font-bold">{metric.label}</h4>
                  <p className="text-lg">
                    {analysis.performanceMetrics[metric.key]}/10
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
