// Lucian UX/UI Prompt #233 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#233
import React, { useState, useEffect, useRef } from "react";
import "./TraceabilityPromptBox.css";

const DEFAULT_EXAMPLES = [
  "Tra cứu nguồn gốc Lô #1 trên Avalanche Fuji",
  "Kiểm tra lịch sử giải ngân Escrow Lô #2",
  "Xác minh chứng nhận VietGAP và nhật ký giao hàng Lô #3"
];

function extractOrderId(rawText) {
  const match = String(rawText).match(/\d+/);
  return match ? match[0] : String(rawText).trim();
}

export default function TraceabilityPromptBox({
  searchId,
  onSearchIdChange,
  onTrace,
  loading,
  orderData,
  rawOrders = [],
  hasContract = false
}) {
  const [inputText, setInputText] = useState(searchId ? String(searchId) : "");
  const [placeholderText, setPlaceholderText] = useState("");
  const [phase, setPhase] = useState("idle"); // 'idle' | 'run' | 'done'
  const [reducedMotion, setReducedMotion] = useState(false);

  const textareaRef = useRef(null);
  const typeTimerRef = useRef(null);
  const wasLoadingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (
      searchId !== undefined &&
      searchId !== null &&
      String(searchId) !== extractOrderId(inputText)
    ) {
      setInputText(String(searchId));
    }
  }, [searchId]);

  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
      setPhase("run");
    } else if (wasLoadingRef.current) {
      wasLoadingRef.current = false;
      setPhase("done");
    }
  }, [loading]);

  const rotatingExamples =
    rawOrders && rawOrders.length > 0
      ? rawOrders.slice(0, 4).map(
          (o) => `Truy xuất Lô #${Number(o.id)} — ${o.productName} trên Avalanche Fuji`
        )
      : DEFAULT_EXAMPLES;

  const suggestionChips =
    rawOrders && rawOrders.length > 0
      ? rawOrders.slice(0, 3).map((o) => {
          const idNum = Number(o.id);
          return {
            id: idNum,
            label: `Lô #${idNum} (${o.productName})`,
            fill: `Truy xuất nguồn gốc Lô #${idNum} (${o.productName})`
          };
        })
      : [
          { id: 1, label: "Lô #1", fill: "Truy xuất nguồn gốc Lô #1" },
          { id: 2, label: "Lô #2", fill: "Truy xuất nguồn gốc Lô #2" },
          { id: 3, label: "Lô #3", fill: "Truy xuất nguồn gốc Lô #3" }
        ];

  useEffect(() => {
    if (inputText || phase === "run") {
      setPlaceholderText("");
      return;
    }

    let exIdx = 0;
    let pos = 0;
    let dir = 1;
    let timer = null;

    const tick = () => {
      const targetStr = rotatingExamples[exIdx % rotatingExamples.length];
      const chars = Array.from(targetStr);

      if (reducedMotion) {
        setPlaceholderText(targetStr);
        exIdx = (exIdx + 1) % rotatingExamples.length;
        timer = setTimeout(tick, 2600);
        return;
      }

      pos += dir;
      setPlaceholderText(chars.slice(0, pos).join(""));

      let wait = 55;
      if (dir > 0 && pos >= chars.length) {
        dir = -1;
        wait = 1500;
      } else if (dir < 0 && pos <= 0) {
        dir = 1;
        exIdx = (exIdx + 1) % rotatingExamples.length;
        wait = 350;
      } else if (dir < 0) {
        wait = 22;
      }
      timer = setTimeout(tick, wait);
    };

    tick();
    return () => clearTimeout(timer);
  }, [inputText, phase, reducedMotion, rawOrders.length]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInputText(val);
    if (phase === "done") setPhase("idle");
    const parsed = extractOrderId(val);
    if (onSearchIdChange && parsed) {
      onSearchIdChange(parsed);
    }
  };

  const handleChipClick = (chip) => {
    clearTimeout(typeTimerRef.current);
    setPlaceholderText("");
    if (phase === "done") setPhase("idle");

    const parsed = String(chip.id);
    if (onSearchIdChange) onSearchIdChange(parsed);

    if (reducedMotion) {
      setInputText(chip.fill);
      return;
    }

    const chars = Array.from(chip.fill);
    let k = 0;
    setInputText("");

    const step = () => {
      k += 1;
      setInputText(chars.slice(0, k).join(""));
      if (k < chars.length) {
        typeTimerRef.current = setTimeout(step, 28);
      }
    };
    step();
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || loading || phase === "run") return;

    const parsedId = extractOrderId(trimmed);
    if (onSearchIdChange) onSearchIdChange(parsedId);

    if (!hasContract) {
      setPhase("done");
      return;
    }

    setPhase("run");
    wasLoadingRef.current = true;

    if (onTrace) {
      onTrace(parsedId);
    }
  };

  const handleNewPrompt = () => {
    clearTimeout(typeTimerRef.current);
    setPhase("idle");
    setInputText("");
    textareaRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isNotFound = phase === "done" && !loading && !orderData;

  const containerClass = [
    "ux",
    "u233",
    phase === "run" ? "is-run" : "",
    phase === "done" ? "is-done" : "",
    isNotFound ? "is-error" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <div className="u233-g">
        <h3 className="u233-h">Truy Xuất Nguồn Gốc Blockchain</h3>
        <div className="u233-s">
          Nhập mã lô hàng (VD: 1, 2) hoặc chọn nhanh bên dưới để kiểm chứng trên Avalanche Fuji
        </div>

        <div className="u233-bx">
          <div className="u233-in">
            <textarea
              ref={textareaRef}
              className="u233-tx"
              rows={2}
              value={inputText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              aria-label="Nhập mã số lô hàng cần truy xuất trên blockchain"
            />
            {!inputText && phase !== "run" && (
              <span className="u233-ph" aria-hidden="true">
                {placeholderText}
              </span>
            )}
            <button
              type="button"
              className="u233-go"
              aria-label="Truy xuất Blockchain"
              disabled={!inputText.trim() || loading || phase === "run"}
              onClick={handleSend}
            >
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M7 12V2M2.5 6.5 7 2l4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="u233-sp" />
            </button>
          </div>
        </div>

        <div className="u233-chs" role="group" aria-label="Gợi ý lô hàng trên chuỗi">
          {suggestionChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="u233-ch"
              onClick={() => handleChipClick(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="u233-gen" aria-live="polite">
        <div className="u233-gh">
          <i aria-hidden="true" />
          <span className="u233-gt">
            {phase === "run"
              ? "Đang truy xuất Smart Contract..."
              : orderData
              ? `Đã xác thực Lô #${orderData.id.toString()} · ${orderData.productName}`
              : `Không tìm thấy dữ liệu cho Lô #${extractOrderId(inputText)}`}
          </span>
        </div>
        <div className="u233-gs">
          {phase === "run"
            ? `Đang quét sự kiện & trạng thái ký quỹ cho "${inputText.trim()}"…`
            : orderData
            ? `Khối lượng: ${orderData.quantityKg.toString()} kg • Trạng thái đã đồng bộ bên dưới`
            : "Vui lòng kiểm tra lại mã lô hoặc kết nối Ví Avalanche Fuji ở góc trên"}
        </div>
        <div className="u233-ln" style={{ width: "92%" }} />
        <div className="u233-ln" style={{ width: "74%" }} />
        <div className="u233-ln" style={{ width: "84%" }} />
        <button type="button" className="u233-nw" onClick={handleNewPrompt}>
          Tra cứu mới
        </button>
      </div>
    </div>
  );
}