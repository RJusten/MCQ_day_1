import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

type AnswerOption = {
  text: string;
  isCorrect: boolean;
  explanation: string;
};

type Question = {
  id: number;
  topic: string;
  question: string;
  answers: AnswerOption[];
};

const ALL_TOPICS = "__ALLE_THEMEN__";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseQuestionsFromCsv(csv: string): Question[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  const topicIndex = headers.indexOf("thema");
  const questionIndex = headers.indexOf("frage");

  const aIndex = headers.indexOf("antwort_a");
  const aExplIndex = headers.indexOf("erklaerung_a");
  const bIndex = headers.indexOf("antwort_b");
  const bExplIndex = headers.indexOf("erklaerung_b");
  const cIndex = headers.indexOf("antwort_c");
  const cExplIndex = headers.indexOf("erklaerung_c");
  const dIndex = headers.indexOf("antwort_d");
  const dExplIndex = headers.indexOf("erklaerung_d");

  const correctIndex = headers.indexOf("korrekt");

  if (
    questionIndex === -1 ||
    correctIndex === -1 ||
    aIndex === -1 ||
    aExplIndex === -1 ||
    bIndex === -1 ||
    bExplIndex === -1
  ) {
    return [];
  }

  const letterMap: Record<string, number> = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
  };

  return lines.slice(1).flatMap((line, idx) => {
    const cols = parseCsvLine(line);

    const topic =
      topicIndex !== -1 && cols[topicIndex] ? cols[topicIndex].trim() : "Allgemein";
    const question = cols[questionIndex]?.trim() || "";
    const correctLetter = (cols[correctIndex] || "").trim().toUpperCase();
    const correctIndexNumber = letterMap[correctLetter];

    const rawAnswers = [
      {
        text: cols[aIndex]?.trim() || "",
        explanation: cols[aExplIndex]?.trim() || "",
      },
      {
        text: cols[bIndex]?.trim() || "",
        explanation: cols[bExplIndex]?.trim() || "",
      },
      {
        text: cIndex !== -1 ? cols[cIndex]?.trim() || "" : "",
        explanation: cExplIndex !== -1 ? cols[cExplIndex]?.trim() || "" : "",
      },
      {
        text: dIndex !== -1 ? cols[dIndex]?.trim() || "" : "",
        explanation: dExplIndex !== -1 ? cols[dExplIndex]?.trim() || "" : "",
      },
    ].filter((answer) => answer.text.length > 0);

    if (!question || rawAnswers.length < 2 || correctIndexNumber === undefined) {
      return [];
    }

    const answers: AnswerOption[] = rawAnswers.map((answer, answerIndex) => ({
      text: answer.text,
      explanation: answer.explanation,
      isCorrect: answerIndex === correctIndexNumber,
    }));

    return [
      {
        id: idx + 1,
        topic,
        question,
        answers,
      },
    ];
  });
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function SimpleMcqTestTool() {
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedTopic, setSelectedTopic] = useState<string>(ALL_TOPICS);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const [score, setScore] = useState({
    correct: 0,
    wrong: 0,
    answered: 0,
  });

  useEffect(() => {
    async function loadQuestions() {
      try {
        setIsLoading(true);
        setLoadError("");

        const response = await fetch("/questions.csv", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("questions.csv konnte nicht geladen werden.");
        }

        const csv = await response.text();
        const parsed = parseQuestionsFromCsv(csv);

        if (parsed.length === 0) {
          throw new Error(
            "Es wurden 0 Fragen erkannt. Bitte prüfe die CSV-Struktur und den Header."
          );
        }

        setAllQuestions(parsed);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unbekannter Fehler beim Laden.";
        setLoadError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadQuestions();
  }, []);

  const topics = useMemo(() => {
    const uniqueTopics = Array.from(new Set(allQuestions.map((q) => q.topic)));
    return uniqueTopics.sort((a, b) => a.localeCompare(b, "de"));
  }, [allQuestions]);

  const filteredQuestions = useMemo(() => {
    if (selectedTopic === ALL_TOPICS) return allQuestions;
    return allQuestions.filter((q) => q.topic === selectedTopic);
  }, [allQuestions, selectedTopic]);

  const currentQuestion = quizQuestions[currentIndex];
  const quizFinished = quizQuestions.length > 0 && currentIndex >= quizQuestions.length;
  const progressPercent =
    quizQuestions.length > 0 ? (currentIndex / quizQuestions.length) * 100 : 0;

  function startQuiz() {
    const questions =
      selectedTopic === ALL_TOPICS ? allQuestions : filteredQuestions;

    if (questions.length === 0) return;

    setQuizQuestions(shuffleArray(questions));
    setCurrentIndex(0);
    setSelectedAnswerIndex(null);
    setShowFeedback(false);
    setScore({ correct: 0, wrong: 0, answered: 0 });
  }

  function resetQuiz() {
    setQuizQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswerIndex(null);
    setShowFeedback(false);
    setScore({ correct: 0, wrong: 0, answered: 0 });
  }

  function handleAnswerClick(answerIndex: number) {
    if (!currentQuestion || showFeedback) return;

    const selectedAnswer = currentQuestion.answers[answerIndex];
    const isCorrect = selectedAnswer.isCorrect;

    setSelectedAnswerIndex(answerIndex);
    setShowFeedback(true);
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
      answered: prev.answered + 1,
    }));
  }

  function nextQuestion() {
    if (!showFeedback) return;

    setCurrentIndex((prev) => prev + 1);
    setSelectedAnswerIndex(null);
    setShowFeedback(false);
  }

  function getCorrectAnswerIndex(question: Question) {
    return question.answers.findIndex((answer) => answer.isCorrect);
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        <section className="hero-card">
          <div className="hero-header">
            <img
              src="/cropped-Quer-mit-Farbschnitt-ohne-Hintergrund.png"
              alt="Kreisfeuerwehrverband Stormarn"
              className="brand-logo-inline"
            />
            <div className="brand-text">
              <h1 className="hero-title">
                Vorbereitungslehrgang Gruppenführungsausbildung
              </h1>
              <p className="hero-subtitle">Ein Angebot des KFV Stormarn</p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Fragen</div>
              <div className="stat-value">{filteredQuestions.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Beantwortet</div>
              <div className="stat-value">{score.answered}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Richtig</div>
              <div className="stat-value">{score.correct}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Falsch</div>
              <div className="stat-value">{score.wrong}</div>
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="controls-row">
            <div className="input-group">
              <label htmlFor="topic-select" className="input-label">
                Thema
              </label>
              <select
                id="topic-select"
                className="number-input"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                disabled={isLoading}
              >
                <option value={ALL_TOPICS}>Alle Themen</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={startQuiz}
              disabled={isLoading || filteredQuestions.length === 0}
            >
              Quiz starten
            </button>

            <button
              className="btn btn-secondary"
              onClick={resetQuiz}
              disabled={quizQuestions.length === 0}
            >
              Zurücksetzen
            </button>
          </div>
        </section>

        <section className="panel-card">
          {isLoading ? (
            <p className="empty-state">Fragen werden geladen ...</p>
          ) : loadError ? (
            <p className="empty-state">
              Fehler beim Laden von <strong>questions.csv</strong>.
              <br />
              <br />
              {loadError}
            </p>
          ) : filteredQuestions.length === 0 ? (
            <p className="empty-state">Keine Fragen für dieses Thema gefunden.</p>
          ) : quizQuestions.length === 0 ? (
            <p className="empty-state">Klicke auf „Quiz starten“.</p>
          ) : quizFinished ? (
            <div>
              <h3 className="question-title">Quiz abgeschlossen</h3>
              <p className="empty-state">
                Ergebnis: {score.correct} richtig, {score.wrong} falsch
              </p>
              <div className="actions-row">
                <button className="btn btn-primary" onClick={startQuiz}>
                  Nochmal starten
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            <div>
              <div className="progress-wrap">
                <div className="progress-top">
                  <span>
                    Frage {currentIndex + 1} von {quizQuestions.length}
                  </span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10, color: "#6b7280", fontWeight: 600 }}>
                Thema: {currentQuestion.topic}
              </div>

              <h3 className="question-title">{currentQuestion.question}</h3>

              <div className="answers-list">
                {currentQuestion.answers.map((answer, index) => {
                  const isSelected = selectedAnswerIndex === index;
                  const isCorrect = answer.isCorrect;
                  const correctAnswerIndex = getCorrectAnswerIndex(currentQuestion);

                  let extraClass = "";
                  if (showFeedback) {
                    if (index === correctAnswerIndex) extraClass = "answer-correct";
                    if (isSelected && !isCorrect) extraClass = "answer-wrong";
                  }

                  return (
                    <button
                      key={index}
                      className={`answer-option answer-button ${extraClass}`}
                      onClick={() => handleAnswerClick(index)}
                      disabled={showFeedback}
                      type="button"
                    >
                      <div>
                        <span className="answer-letter">
                          {String.fromCharCode(65 + index)}.
                        </span>{" "}
                        {answer.text}
                      </div>

                      {showFeedback && isSelected && (
                        <div className="answer-explanation">
                          {answer.explanation}
                        </div>
                      )}

                      {showFeedback && index === correctAnswerIndex && !isSelected && (
                        <div className="answer-explanation">
                          Richtige Antwort.
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {showFeedback && selectedAnswerIndex !== null && (
                <div
                  className={`feedback-box ${
                    currentQuestion.answers[selectedAnswerIndex].isCorrect
                      ? "feedback-correct"
                      : "feedback-wrong"
                  }`}
                >
                  {currentQuestion.answers[selectedAnswerIndex].isCorrect ? (
                    <strong>Richtig.</strong>
                  ) : (
                    <strong>Falsch.</strong>
                  )}
                </div>
              )}

              <div className="actions-row">
                <button className="btn btn-primary" onClick={nextQuestion}>
                  Nächste Frage
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <div className="footer-note">
          Ausschließlich entwickelt für den Vorbereitungslehrgang
          Gruppenführungsausbildung des Kreisfeuerwehrverbandes Stormarn.{" "}
          <strong>Developed by Richard Justenhoven</strong>
        </div>
      </div>
    </div>
  );
}
