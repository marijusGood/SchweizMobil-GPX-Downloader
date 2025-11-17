import { useState, type JSX } from "react";
import './App.css';

type ActivityType = "hiking" | "cycling";

interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

interface SuccessModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

function ErrorModal({ isOpen, title, message, onClose }: ErrorModalProps): JSX.Element {
  if (!isOpen) return <></>;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-content">
          <div className="modal-header error">
            <div className="modal-icon error">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="modal-title">{title}</h3>
          </div>
          <p className="modal-message">{message}</p>
          <div className="modal-actions">
            <button
              onClick={onClose}
              className="btn btn-error"
            >
              Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ isOpen, message, onClose }: SuccessModalProps): JSX.Element {
  if (!isOpen) return <></>;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-content">
          <div className="modal-header success">
            <div className="modal-icon success">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L6.53 10.47a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.154-.114l4-5.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="modal-title">Success!</h3>
          </div>
          <p className="modal-message">{message}</p>
          <div className="modal-actions">
            <button
              onClick={onClose}
              className="btn btn-success"
            >
              Great!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  const [activityType, setActivityType] = useState<ActivityType>("hiking");
  const [routeNumber, setRouteNumber] = useState<number | "">("");
  const [useSegment, setUseSegment] = useState(false);
  const [segmentNumber, setSegmentNumber] = useState<number | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: "",
    message: ""
  });
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: ""
  });

  const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

  const buildDownloadUrl = (): string => {
    if (!routeNumber) return "";
    
    const base = `${API_BASE}/route/${encodeURIComponent(activityType)}/${routeNumber}`;
    return useSegment && segmentNumber ? `${base}/part/${segmentNumber}` : base;
  };

  const getFileName = (): string => {
    if (!routeNumber) return "";
    const base = `route${routeNumber}`;
    return useSegment && segmentNumber ? `${base}-part${segmentNumber}.gpx` : `${base}.gpx`;
  };

  const validateInputs = (): string | null => {
    if (!routeNumber) {
      return "Please enter a route number to continue.";
    }
    
    if (routeNumber < 1) {
      return "Route number must be a positive number.";
    }
    
    if (useSegment && !segmentNumber) {
      return "Please enter a segment number or disable segment download.";
    }
    
    if (useSegment && segmentNumber && segmentNumber < 1) {
      return "Segment number must be a positive number.";
    }
    
    return null;
  };

  const handleDownload = async (): Promise<void> => {
    setErrorModal({ isOpen: false, title: "", message: "" });
    setSuccessModal({ isOpen: false, message: "" });

    const validationError = validateInputs();
    if (validationError) {
      setErrorModal({
        isOpen: true,
        title: "Input Required",
        message: validationError
      });
      return;
    }

    const downloadUrl = buildDownloadUrl();
    if (!downloadUrl) {
      setErrorModal({
        isOpen: true,
        title: "Configuration Error",
        message: "Unable to build download URL. Please check your inputs and try again."
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          "Accept": "application/xml",
        },
      });

      if (!response.ok) {
        let errorDetail = "The server returned an error. Please try again.";
        
        try {
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorData.message || JSON.stringify(errorData);
          } else {
            errorDetail = await response.text();
          }
        } catch {
          // Use default error message if parsing fails
        }

        throw new Error(
          response.status === 404 
            ? "Route or segment not found. Please check the numbers and try again."
            : `Server error: ${response.status} - ${errorDetail}`
        );
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("The server returned an empty file. The route or segment might not exist.");
      }

      const fileName = getFileName();
      const urlObject = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = urlObject;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlObject);

      setSuccessModal({
        isOpen: true,
        message: `Successfully downloaded "${fileName}". You can now import this GPX file into your navigation app or device.`
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
      
      setErrorModal({
        isOpen: true,
        title: "Download Failed",
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = (): void => {
    setRouteNumber("");
    setSegmentNumber("");
    setUseSegment(false);
    setActivityType("hiking");
    setErrorModal({ isOpen: false, title: "", message: "" });
    setSuccessModal({ isOpen: false, message: "" });
  };

  const activityExamples = {
    hiking: [
      { number: 51, name: "Jura Crest Trail" },
      { number: 3, name: "Alpine Passes Trail" },
      { number: 7, name: "Via Alpina" }
    ],
    cycling: [
      { number: 9, name: "Lakes Route" },
      { number: 1, name: "Rhone Route" },
      { number: 4, name: "Alpine Panorama Route" }
    ]
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo">
                <svg className="logo-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="logo-text">
                <h1 className="app-title">SchweizMobil GPX Downloader</h1>
                <p className="app-subtitle">Get hiking and cycling routes for Switzerland</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          <div className="content-grid">
            {/* Download Form */}
            <div className="form-section">
              <div className="card form-card">
                <div className="card-header">
                  <h2 className="card-title">Download GPX Route</h2>
                  <p className="card-description">Get GPX files for hiking and cycling routes from SchweizMobil</p>
                </div>

                {/* Activity Type Selection */}
                <div className="form-group">
                  <label className="form-label">Activity Type</label>
                  <div className="activity-grid">
                    <button
                      type="button"
                      onClick={() => setActivityType("hiking")}
                      className={`activity-card ${activityType === "hiking" ? "activity-card-active hiking" : ""}`}
                    >
                      <div className="activity-card-content">
                        <div className={`activity-icon ${activityType === "hiking" ? "active" : ""}`}>
                          <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="activity-text">
                          <div className="activity-name">Hiking</div>
                          <div className="activity-subtitle">Wanderland Routes</div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setActivityType("cycling")}
                      className={`activity-card ${activityType === "cycling" ? "activity-card-active cycling" : ""}`}
                    >
                      <div className="activity-card-content">
                        <div className={`activity-icon ${activityType === "cycling" ? "active" : ""}`}>
                          <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="activity-text">
                          <div className="activity-name">Cycling</div>
                          <div className="activity-subtitle">Veloland Routes</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Route Number Input */}
                <div className="form-group">
                  <label htmlFor="routeNumber" className="form-label">
                    Route Number
                  </label>
                  <input
                    id="routeNumber"
                    type="number"
                    value={routeNumber}
                    onChange={(e) => setRouteNumber(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g., 51 for Jura Crest Trail"
                    className="form-input"
                    min="1"
                    disabled={isLoading}
                  />
                  <div className="examples">
                    {activityExamples[activityType].map((example) => (
                      <button
                        key={example.number}
                        type="button"
                        onClick={() => setRouteNumber(example.number)}
                        className="example-btn"
                      >
                        #{example.number} - {example.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Segment Option */}
                <div className="form-group">
                  <div className="checkbox-group">
                    <input
                      id="useSegment"
                      type="checkbox"
                      checked={useSegment}
                      onChange={(e) => setUseSegment(e.target.checked)}
                      className="checkbox"
                      disabled={isLoading}
                    />
                    <label htmlFor="useSegment" className="checkbox-label">
                      Download specific segment/part
                    </label>
                  </div>
                  
                  {useSegment && (
                    <div className="segment-input">
                      <label htmlFor="segmentNumber" className="form-label">
                        Segment Number
                      </label>
                      <input
                        id="segmentNumber"
                        type="number"
                        value={segmentNumber}
                        onChange={(e) => setSegmentNumber(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="e.g., 1 for first segment"
                        className="form-input"
                        min="1"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="actions">
                  <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="btn btn-primary download-btn"
                  >
                    {isLoading ? (
                      <>
                        <svg className="spinner" viewBox="0 0 24 24">
                          <circle className="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Downloading...
                      </>
                    ) : (
                      <>
                        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download GPX File
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleReset}
                    disabled={isLoading}
                    className="btn btn-secondary"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Documentation & Help */}
            <div className="sidebar">
              {/* Quick Guide */}
              <div className="card help-card">
                <h3 className="help-title">
                  <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  How to Use
                </h3>
                <div className="steps">
                  <div className="step">
                    <div className="step-number">1</div>
                    <p>Select hiking or cycling based on your activity</p>
                  </div>
                  <div className="step">
                    <div className="step-number">2</div>
                    <p>Enter the route number (check SchweizMobil for numbers)</p>
                  </div>
                  <div className="step">
                    <div className="step-number">3</div>
                    <p>Optionally enable segment download for route parts</p>
                  </div>
                  <div className="step">
                    <div className="step-number">4</div>
                    <p>Click download and import the GPX file to your device</p>
                  </div>
                </div>
              </div>

              {/* Examples */}
              <div className="card examples-card">
                <h3 className="examples-title">Popular Routes</h3>
                <div className="examples-content">
                  <div className="route-type">
                    <h4 className="route-type-title">Hiking Routes</h4>
                    <div className="route-list">
                      {activityExamples.hiking.map((route) => (
                        <div key={route.number} className="route-item">
                          <span className="route-info">#{route.number} {route.name}</span>
                          <button
                            onClick={() => {
                              setActivityType("hiking");
                              setRouteNumber(route.number);
                              setUseSegment(false);
                            }}
                            className="route-use-btn"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="route-type">
                    <h4 className="route-type-title">Cycling Routes</h4>
                    <div className="route-list">
                      {activityExamples.cycling.map((route) => (
                        <div key={route.number} className="route-item">
                          <span className="route-info">#{route.number} {route.name}</span>
                          <button
                            onClick={() => {
                              setActivityType("cycling");
                              setRouteNumber(route.number);
                              setUseSegment(false);
                            }}
                            className="route-use-btn"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Troubleshooting */}
              <div className="card troubleshooting-card">
                <h3 className="troubleshooting-title">Need Help?</h3>
                <div className="faq">
                  <details className="faq-item">
                    <summary className="faq-question">
                      Where to find route numbers?
                    </summary>
                    <p className="faq-answer">
                      Visit SchweizMobil website and look for route numbers in the URL or route details page.
                    </p>
                  </details>
                  <details className="faq-item">
                    <summary className="faq-question">
                      What apps support GPX files?
                    </summary>
                    <p className="faq-answer">
                      Most navigation apps like Komoot, Gaia GPS, AllTrails, and Garmin devices support GPX imports.
                    </p>
                  </details>
                  <details className="faq-item">
                    <summary className="faq-question">
                      File won't open?
                    </summary>
                    <p className="faq-answer">
                      Ensure you're importing as GPX track. Some apps require specific import methods for GPX files.
                    </p>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ isOpen: false, title: "", message: "" })}
      />
      
      <SuccessModal
        isOpen={successModal.isOpen}
        message={successModal.message}
        onClose={() => setSuccessModal({ isOpen: false, message: "" })}
      />
    </div>
  );
}