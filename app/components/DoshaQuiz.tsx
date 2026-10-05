import { useEffect, useState } from "react";
import type { QuizResult } from "../quiz.server";

type QuickQuestion = {
  phase: string;
  text: string;
  sub: string;
  options: { value: string; label: string; hint: string }[];
};
type DeepQuestion = {
  layer: number;
  phase: string;
  text: string;
  sub: string;
  options: { label: string; hint: string }[];
};

type Payload =
  | { path: "quick"; answers: Record<string, string> }
  | { path: "deep"; answers: number[] }
  | { path: "scan" };

export default function DoshaQuiz({
  quick,
  deep,
  shop,
  pending,
  result,
  onSubmit,
}: {
  quick: QuickQuestion[];
  deep: DeepQuestion[];
  shop: string;
  pending: boolean;
  result: QuizResult | null;
  onSubmit: (payload: Payload) => void;
}) {
  const [screen, setScreen] = useState<"entry" | "quick" | "deep" | "scan" | "result">("entry");
  const [quickStep, setQuickStep] = useState(0);
  const [quickAnswers, setQuickAnswers] = useState<Record<string, string>>({});
  const [deepStep, setDeepStep] = useState(0);
  const [deepAnswers, setDeepAnswers] = useState<Record<number, number>>({});
  const [consentBio, setConsentBio] = useState(false);
  const [consentAge, setConsentAge] = useState(false);
  const [consentError, setConsentError] = useState("");

  useEffect(() => {
    if (result) setScreen("result");
  }, [result]);

  const question = deep[deepStep];
  const quickQuestion = quick[quickStep];

  function openPath(next: "quick" | "deep" | "scan") {
    if (next === "quick") {
      setQuickStep(0);
      setQuickAnswers({});
    }
    if (next === "deep") {
      setDeepStep(0);
      setDeepAnswers({});
    }
    setConsentError("");
    setScreen(next);
  }

  return (
    <div className="prana-quiz">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap"
      />

      {screen === "entry" && (
        <div className="screen active">
          <div className="hdr">
            <div className="hdr-logo">PRANA Beauty & Wellness</div>
            <h1 className="hdr-title">
              Find Your <em>Skin Ritual</em>
            </h1>
            <div className="hdr-sub">Three paths. One result. Scored by the app backend.</div>
          </div>
          <div className="entry-cards">
            <div className="entry-card featured" onClick={() => openPath("scan")} role="button" tabIndex={0}>
              <div className="ec-badge">Most accurate</div>
              <div className="ec-icon scan">📷</div>
              <div className="ec-name">AI Skin Scan</div>
              <div className="ec-desc">The app reads the scan path and returns your ritual.</div>
              <div className="ec-time">✦ 30 seconds</div>
              <button className="btn-entry" type="button">Start Scan</button>
            </div>
            <div className="entry-card" onClick={() => openPath("quick")} role="button" tabIndex={0}>
              <div className="ec-icon quick">⚡</div>
              <div className="ec-name">Quick Quiz</div>
              <div className="ec-desc">Three questions. The backend matches your dosha.</div>
              <div className="ec-time">✦ 60 seconds</div>
              <button className="btn-entry ghost" type="button">Take Quiz</button>
            </div>
            <div className="entry-card" onClick={() => openPath("deep")} role="button" tabIndex={0}>
              <div className="ec-icon deep">🌿</div>
              <div className="ec-name">Deep Dosha</div>
              <div className="ec-desc">18 questions. Constitution, current state, and environment.</div>
              <div className="ec-time">✦ 5 minutes</div>
              <button className="btn-entry ghost" type="button">Begin Reading</button>
            </div>
          </div>
          <div className="entry-note">
            Customers see this same quiz on the storefront. Add the AI Dosha Quiz section in the{" "}
            <a href={`https://${shop}/admin/themes/current/editor`}>theme editor</a>.
          </div>
        </div>
      )}

      {screen === "quick" && quickQuestion && (
        <div className="screen active">
          <button className="back-nav" type="button" onClick={() => setScreen("entry")}>← Back</button>
          <div className="hdr" style={{ paddingTop: "1rem" }}>
            <div className="hdr-logo">PRANA Beauty & Wellness</div>
            <h1 className="hdr-title">Quick <em>Ritual Match</em></h1>
          </div>
          <div className="quiz-wrap">
            <div className="quiz-progress">
              <div className="qp-bar">
                <div className="qp-fill" style={{ width: `${((quickStep + 1) / quick.length) * 100}%` }} />
              </div>
              <div className="qp-label">
                <span>{quickQuestion.phase}</span>
                <span>{quickStep + 1} of {quick.length}</span>
              </div>
            </div>
            <div className="q-step active">
              <div className="q-text">{quickQuestion.text}</div>
              <div className="q-sub">{quickQuestion.sub}</div>
              <div className="q-options">
                {quickQuestion.options.map((option) => (
                  <div
                    key={option.value}
                    className={`q-opt${quickAnswers[`q${quickStep + 1}`] === option.value ? " selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setQuickAnswers((current) => ({ ...current, [`q${quickStep + 1}`]: option.value }))}
                  >
                    <div className="q-opt-dot" />
                    <div className="q-opt-text">
                      <div className="q-opt-main">{option.label}</div>
                      <div className="q-opt-hint">{option.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="q-nav">
              <button
                className="btn-back"
                type="button"
                style={{ visibility: quickStep === 0 ? "hidden" : "visible" }}
                onClick={() => setQuickStep((step) => Math.max(0, step - 1))}
              >
                ← Back
              </button>
              <button
                className={`btn-next${quickAnswers[`q${quickStep + 1}`] ? " ready" : ""}`}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!quickAnswers[`q${quickStep + 1}`]) return;
                  if (quickStep < quick.length - 1) setQuickStep((step) => step + 1);
                  else onSubmit({ path: "quick", answers: quickAnswers });
                }}
              >
                {pending ? "Reading…" : "Continue →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "deep" && question && (
        <div className="screen active">
          <button className="back-nav" type="button" onClick={() => setScreen("entry")}>← Back</button>
          <div className="hdr" style={{ paddingTop: "1rem" }}>
            <div className="hdr-logo">PRANA Beauty & Wellness</div>
            <h1 className="hdr-title">Dosha <em>Diagnostic</em></h1>
          </div>
          <div className="quiz-wrap">
            <div className="layer-pills">
              {[1, 2, 3].map((layer) => (
                <div key={layer} className={`layer-pill${question.layer === layer ? " active" : ""}`}>
                  Layer {layer}
                </div>
              ))}
            </div>
            <div className="quiz-progress">
              <div className="qp-bar">
                <div className="qp-fill" style={{ width: `${((deepStep + 1) / deep.length) * 100}%` }} />
              </div>
              <div className="qp-label">
                <span>{question.phase}</span>
                <span>{deepStep + 1} of {deep.length}</span>
              </div>
            </div>
            <div className="q-step active">
              <div className="q-text">{question.text}</div>
              <div className="q-sub">{question.sub}</div>
              <div className="q-options">
                {question.options.map((option, index) => (
                  <div
                    key={option.label}
                    className={`q-opt${deepAnswers[deepStep] === index ? " selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDeepAnswers((current) => ({ ...current, [deepStep]: index }))}
                  >
                    <div className="q-opt-dot" />
                    <div className="q-opt-text">
                      <div className="q-opt-main">{option.label}</div>
                      <div className="q-opt-hint">{option.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="q-nav">
              <button
                className="btn-back"
                type="button"
                style={{ visibility: deepStep === 0 ? "hidden" : "visible" }}
                onClick={() => setDeepStep((step) => Math.max(0, step - 1))}
              >
                ← Back
              </button>
              <button
                className={`btn-next${deepAnswers[deepStep] !== undefined ? " ready" : ""}`}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (deepAnswers[deepStep] === undefined) return;
                  if (deepStep < deep.length - 1) setDeepStep((step) => step + 1);
                  else onSubmit({ path: "deep", answers: deep.map((_, index) => deepAnswers[index] ?? 0) });
                }}
              >
                {pending ? "Reading…" : "Continue →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "scan" && (
        <div className="screen active">
          <button className="back-nav" type="button" onClick={() => setScreen("entry")}>← Back</button>
          <div className="hdr" style={{ paddingTop: "1rem" }}>
            <div className="hdr-logo">PRANA Beauty & Wellness</div>
            <h1 className="hdr-title">AI <em>Skin Scan</em></h1>
            <div className="hdr-sub">The reading is prepared by the app. Photos are not uploaded.</div>
          </div>
          <div className="scanner-wrap">
            <div className="consent-box">
              <div className="consent-row">
                <input id="admin-consent-bio" className="consent-check" type="checkbox" checked={consentBio} onChange={(event) => setConsentBio(event.target.checked)} />
                <label className="consent-label" htmlFor="admin-consent-bio"><strong>I consent to a real-time skin reading.</strong> My photo is not stored.</label>
              </div>
              <div className="consent-row">
                <input id="admin-consent-age" className="consent-check" type="checkbox" checked={consentAge} onChange={(event) => setConsentAge(event.target.checked)} />
                <label className="consent-label" htmlFor="admin-consent-age"><strong>I confirm I am 18 or older.</strong></label>
              </div>
            </div>
            {consentError && <div className="consent-error show">{consentError}</div>}
            <button
              className="btn-scan"
              type="button"
              disabled={pending}
              onClick={() => {
                if (!consentBio || !consentAge) {
                  setConsentError("Please accept the required consents before scanning.");
                  return;
                }
                setConsentError("");
                onSubmit({ path: "scan" });
              }}
            >
              {pending ? "Reading…" : "Analyse My Skin →"}
            </button>
          </div>
        </div>
      )}

      {screen === "result" && result && (
        <div className="screen active">
          <button className="back-nav" type="button" onClick={() => setScreen("entry")}>← Start Over</button>
          <div className="result-wrap">
            <div className={`result-hero ${result.profile.heroClass}`}>
              <div className="rh-tag">Your Dosha Profile</div>
              <div className="rh-dosha">{result.profile.name}</div>
              <div className="rh-sub">{result.profile.sub}</div>
              <div className="rh-essence">{result.profile.essence}</div>
              <div className="rh-source">via {result.source}</div>
            </div>
            {result.markers && (
              <div className="result-section">
                <div className="rs-label">Skin Analysis</div>
                <div className="result-card">
                  <div className="skin-markers">
                    {Object.entries(result.markers).map(([key, marker]) => (
                      <div className="marker-item" key={key}>
                        <div className="marker-bar">
                          <div className={`marker-fill ${marker.score > 70 ? "high" : marker.score > 40 ? "mid" : "low"}`} style={{ width: `${marker.score}%` }} />
                        </div>
                        <div className="marker-val">{marker.label}</div>
                        <div className="marker-name">{key}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="result-section">
              <div className="rs-label">Your Skin Reading</div>
              <div className="result-card">
                <div className="insight-text" dangerouslySetInnerHTML={{ __html: result.insight }} />
              </div>
            </div>
            <div className="result-section">
              <div className="rs-label">Your Ritual</div>
              <div className="product-cards">
                {result.products.map((product) => (
                  <div className="product-card" key={product.handle}>
                    <div className="pc-img">{product.image ? <img src={product.image} alt={product.title} /> : <span className="no-img">✦</span>}</div>
                    <div className="pc-body">
                      <div className="pc-name">{product.title}</div>
                      {product.why && <div className="pc-why">{product.why}</div>}
                      <div className="pc-bottom">
                        <span className="pc-price">{product.price}</span>
                        <a className="btn-shop" href={`https://${shop}/products/${product.handle}${product.variantId ? `?variant=${product.variantId.split("/").pop()}` : ""}`} target="_blank" rel="noreferrer">Shop Now →</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
