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
  const w = useWorkspace();
  if (w.loading) return <Busy />;
  if (w.session?.user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="public-site">
      <header className="public-nav">
        <Link className="public-brand" to="/">
          STRIVE<span>IDEA ASSESSMENT</span>
        </Link>
        <nav>
          <a href="#how-it-works">How it works</a>
          <Link to="/login">Sign in</Link>
          <Link className="button primary" to="/register">
            Get started <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="home-hero">
          <div>
            <span className="eyebrow">FROM AN IDEA TO A CLEARER NEXT STEP</span>
            <h1>
              Your business idea.
              <br />A place to grow.
            </h1>
            <p>
              Share your idea in your own words. Get a structured assessment,
              understand what needs more detail, and take the next step with
              your programme assessor.
            </p>
            <div className="home-actions">
              <Link className="button primary" to="/register">
                Create your account <ArrowRight size={16} />
              </Link>
              <Link className="button secondary" to="/login">
                I already have an account
              </Link>
            </div>
            <div className="home-trust">
              <ShieldCheck size={16} /> Your dashboard. Your submissions. Your
              progress.
            </div>
          </div>
          <div className="home-preview" aria-label="How an assessment works">
            <div className="preview-heading">
              <span className="eyebrow">YOUR IDEA, MADE CLEARER</span>
              <FileText size={21} />
            </div>
            <h2>Start with what you know.</h2>
            <p>
              You do not need a perfect business plan. Share the details you
              have and come back to fill the gaps.
            </p>
            <div className="preview-step">
              <span>01</span>
              <div>
                <strong>Share your business idea</strong>
                <small>Write, upload a PDF, or record your voice.</small>
              </div>
              <Check size={18} />
            </div>
            <div className="preview-step">
              <span>02</span>
              <div>
                <strong>See your assessment</strong>
                <small>Facts stay linked to what you submitted.</small>
              </div>
              <Check size={18} />
            </div>
            <div className="preview-step">
              <span>03</span>
              <div>
                <strong>Build on the feedback</strong>
                <small>Answer questions and track your progress.</small>
              </div>
              <ArrowRight size={18} />
            </div>
            <div className="preview-foot">
              Scores describe the information supplied. People make the final
              decisions.
            </div>
          </div>
        </section>
        <section className="home-process" id="how-it-works">
          <div>
            <span className="eyebrow">A SIMPLE WAY FORWARD</span>
            <h2>One workspace for the next conversation.</h2>
          </div>
          <div className="home-features">
            <article>
              <FileText />
              <h3>Start in your own words</h3>
              <p>
                Use guided questions, free text, a PDF, or a recording to
                explain your business.
              </p>
            </article>
            <article>
              <Languages />
              <h3>Keep your voice</h3>
              <p>
                Regional-language submissions retain the original alongside the
                English assessment.
              </p>
            </article>
            <article>
              <ShieldCheck />
              <h3>Know where you stand</h3>
              <p>
                Your private dashboard shows your submissions, scores,
                questions, and assessor feedback.
              </p>
            </article>
          </div>
        </section>
        <section className="home-assessor">
          <div>
            <span className="eyebrow">FOR PROGRAMME ASSESSORS</span>
            <h2>
              Less time gathering details.
              <br />
              More time helping people.
            </h2>
            <p>
              Review submitted evidence, compare programme ideas, and give clear
              next steps from a dedicated assessor workspace.
            </p>
          </div>
          <Link className="button secondary" to="/login?role=assessor">
            Assessor sign in <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <footer className="public-footer">
        <strong>STRIVE</strong>
        <span>Grounded in evidence. Guided by people.</span>
        <Link to="/login">Sign in to your workspace</Link>
      </footer>
    </div>
  );
}
