// localized-ui
import ReadMore from "../ReadMore";
import { t, useLanguage, LanguageControl } from "../i18n";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  AudioLines,
  ShieldCheck,
  Check,
  Languages,
} from "lucide-react";
import { useWorkspace } from "../workspace";
import { Busy } from "../components";
export default function Home() {
  useLanguage();
  const w = useWorkspace();
  if (w.loading) return <Busy />;
  if (w.session?.user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="public-site">
      <header className="public-nav">
        <Link className="public-brand" to="/">
          {t("STRIVE")}
          <span>{t("IDEA ASSESSMENT")}</span>
        </Link>
        <nav>
          <LanguageControl />
          <a href="#how-it-works">{t("How it works")}</a>
          <Link to="/login">{t("Sign in")}</Link>
          <Link className="button primary" to="/register">
            {t("Get started")} <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="home-hero">
          <div>
            <span className="eyebrow">
              {t("FROM AN IDEA TO A CLEARER NEXT STEP")}
            </span>
            <h1>
              {t("Your business idea.")}
              <br />
              {t("A place to grow.")}
            </h1>
            <p>
              {t("Share your idea. See what is missing. Plan your next step.")}
            </p>
            <ReadMore title="How it works">
              {" "}
              <p>
                {t(
                  "Share your idea in your own words. Get a structured assessment, understand what needs more detail, and take the next step with your programme assessor.",
                )}
              </p>
            </ReadMore>
            <div className="home-actions">
              <Link className="button primary" to="/register">
                {t("Create your account")} <ArrowRight size={16} />
              </Link>
              <Link className="button secondary" to="/login">
                {t("I already have an account")}
              </Link>
            </div>
            <div className="home-trust">
              <ShieldCheck size={16} />{" "}
              {t("Your dashboard. Your submissions. Your progress.")}
            </div>
          </div>
          <div
            className="home-preview"
            aria-label={t("How an assessment works")}
          >
            <div className="preview-heading">
              <span className="eyebrow">{t("YOUR IDEA, MADE CLEARER")}</span>
              <FileText size={21} />
            </div>
            <h2>{t("Start with what you know.")}</h2>
            <p>
              {t(
                "You do not need a perfect business plan. Share the details you have and come back to fill the gaps.",
              )}
            </p>
            <div className="preview-step">
              <span>01</span>
              <div>
                <strong>{t("Share your business idea")}</strong>
                <small>{t("Write, upload a PDF, or record your voice.")}</small>
              </div>
              <Check size={18} />
            </div>
            <div className="preview-step">
              <span>02</span>
              <div>
                <strong>{t("See your assessment")}</strong>
                <small>{t("Facts stay linked to what you submitted.")}</small>
              </div>
              <Check size={18} />
            </div>
            <div className="preview-step">
              <span>03</span>
              <div>
                <strong>{t("Build on the feedback")}</strong>
                <small>{t("Answer questions and track your progress.")}</small>
              </div>
              <ArrowRight size={18} />
            </div>
            <div className="preview-foot">
              {t(
                "Scores describe the information supplied. People make the final decisions.",
              )}
            </div>
          </div>
        </section>
        <section className="home-process" id="how-it-works">
          <div>
            <span className="eyebrow">{t("A SIMPLE WAY FORWARD")}</span>
            <h2>{t("One workspace for the next conversation.")}</h2>
          </div>
          <div className="home-features">
            <article>
              <FileText />
              <h3>{t("Start in your own words")}</h3>
              <p>
                {t(
                  "Use guided questions, free text, a PDF, or a recording to explain your business.",
                )}
              </p>
            </article>
            <article>
              <Languages />
              <h3>{t("Keep your voice")}</h3>
              <p>
                {t(
                  "Regional-language submissions retain the original alongside the English assessment.",
                )}
              </p>
            </article>
            <article>
              <ShieldCheck />
              <h3>{t("Know where you stand")}</h3>
              <p>
                {t(
                  "Your private dashboard shows your submissions, scores, questions, and assessor feedback.",
                )}
              </p>
            </article>
          </div>
        </section>
        <section className="home-assessor">
          <div>
            <span className="eyebrow">{t("FOR PROGRAMME ASSESSORS")}</span>
            <h2>
              {t("Less time gathering details.")}
              <br />
              {t("More time helping people.")}
            </h2>
            <p>
              {t(
                "Review submitted evidence, compare programme ideas, and give clear next steps from a dedicated assessor workspace.",
              )}
            </p>
          </div>
          <Link className="button secondary" to="/login?role=assessor">
            {t("Assessor sign in")} <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <strong>{t("STRIVE")}</strong>
        <span>{t("Grounded in evidence. Guided by people.")}</span>
        <Link to="/login">{t("Sign in to your workspace")}</Link>
      </footer>
    </div>
  );
}
