// Lucian UX/UI Prompt #244 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#244
import React, { useState, useRef, useId } from 'react';
import './CreateEscrowForm.css';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const FIELD_CONFIG = [
  {
    key: 'productName',
    label: 'Tên nông sản',
    badge: 'VietGAP / GlobalGAP',
    badgeType: 'success',
    placeholder: 'VD: Sầu riêng Ri6',
    type: 'text',
    errorMsg: 'Vui lòng nhập tên nông sản (ít nhất 2 ký tự)',
    validate: (val) => val.trim().length >= 2,
  },
  {
    key: 'weight',
    label: 'Khối lượng thương phẩm',
    unit: 'KG',
    placeholder: '100',
    type: 'number',
    step: 'any',
    errorMsg: 'Khối lượng phải lớn hơn 0 KG',
    validate: (val) => Number(val) > 0,
  },
  {
    key: 'farmerAddress',
    label: 'Địa chỉ ví Nông dân',
    badge: '✓ Hợp tác xã xác thực',
    badgeType: 'success',
    placeholder: '0x8196...',
    type: 'text',
    isMono: true,
    errorMsg: 'Địa chỉ ví EVM không hợp lệ (cần bắt đầu bằng 0x và đủ 42 ký tự)',
    validate: (val) => EVM_ADDRESS_REGEX.test(val.trim()),
  },
  {
    key: 'arbiterAddress',
    label: 'Địa chỉ ví Trọng tài / Giám định',
    badge: 'Kiểm định độc lập',
    badgeType: 'neutral',
    placeholder: '0x1E6c...',
    type: 'text',
    isMono: true,
    errorMsg: 'Địa chỉ ví Trọng tài không hợp lệ (cần đúng định dạng 0x... 42 ký tự)',
    validate: (val) => EVM_ADDRESS_REGEX.test(val.trim()),
  },
  {
    key: 'amountAvax',
    label: 'Tổng tiền khóa Escrow (AVAX)',
    unit: 'AVAX',
    unitVariant: 'avax',
    placeholder: '0.1',
    type: 'number',
    step: 'any',
    errorMsg: 'Số tiền ký quỹ phải lớn hơn 0 AVAX',
    validate: (val) => Number(val) > 0,
  },
];

export default function CreateEscrowForm({ onCreateOrder, isSubmitting = false }) {
  const uid = useId();
  const [values, setValues] = useState({
    productName: '',
    weight: '100',
    farmerAddress: '',
    arbiterAddress: '',
    amountAvax: '0.1',
  });

  const [tried, setTried] = useState(false);
  const [summaryKeys, setSummaryKeys] = useState([]); // Danh sách lỗi chụp tại thời điểm bấm nút
  const [shakeMap, setShakeMap] = useState({});
  const [isDone, setIsDone] = useState(false);

  const fieldRefs = useRef({});
  const inputRefs = useRef({});

  // Tính toán lỗi hiện tại theo thời gian thực
  const currentInvalidKeys = FIELD_CONFIG.filter(
    (f) => !f.validate(values[f.key] ?? '')
  ).map((f) => f.key);

  const remainingErrorCount = currentInvalidKeys.length;

  // Tính toán phân rã 30% / 70%
  const numericAvax = Math.max(0, Number(values.amountAvax) || 0);
  const stage1Avax = (numericAvax * 0.3).toFixed(3);
  const stage2Avax = (numericAvax * 0.7).toFixed(3);

  // Hàm trượt mượt tới ô lỗi và focus con trỏ
  const scrollToField = (key) => {
    const fieldEl = fieldRefs.current[key];
    const inputEl = inputRefs.current[key];
    if (!fieldEl) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rect = fieldEl.getBoundingClientRect();
    const targetY = Math.max(0, window.scrollY + rect.top - 90);

    if (prefersReduced) {
      window.scrollTo(0, targetY);
      inputEl?.focus({ preventScroll: true });
      return;
    }

    const startY = window.scrollY;
    const duration = 520;
    const t0 = performance.now();

    const step = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - k, 3); // cubic ease-out giống nguyên bản
      window.scrollTo(0, startY + (targetY - startY) * ease);
      if (k < 1) {
        requestAnimationFrame(step);
      } else {
        inputEl?.focus({ preventScroll: true });
      }
    };
    requestAnimationFrame(step);
  };

  // Kích hoạt lại animation rung lắc
  const triggerShake = (keys) => {
    setShakeMap({});
    requestAnimationFrame(() => {
      const nextShake = {};
      keys.forEach((k) => {
        nextShake[k] = true;
      });
      setShakeMap(nextShake);
    });
  };

  const handleChange = (key, val) => {
    if (isDone) setIsDone(false);
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setTried(true);

    if (currentInvalidKeys.length > 0) {
      setSummaryKeys(currentInvalidKeys);
      triggerShake(currentInvalidKeys);
      const firstKey = currentInvalidKeys[0];
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => {
        scrollToField(firstKey);
      }, prefersReduced ? 0 : 200);
      return;
    }

    // Tất cả hợp lệ -> Gọi hàm tạo Smart Contract của dự án
    setSummaryKeys([]);
    if (onCreateOrder) {
      await onCreateOrder({
        productName: values.productName.trim(),
        weight: Number(values.weight),
        farmerAddress: values.farmerAddress.trim(),
        arbiterAddress: values.arbiterAddress.trim(),
        amountAvax: values.amountAvax,
      });
    }
    setIsDone(true);
  };

  const hasVisibleErrors = tried && remainingErrorCount > 0;

  return (
    <div className={`u244 ${hasVisibleErrors ? 'is-err' : ''}`}>
      <form className="u244-sc" onSubmit={handleSubmit} noValidate aria-label="Tạo đơn hàng ký quỹ mới">
        <div className="u244-hd">
          <h3>🌱 Tạo Đơn Hàng Ký Quỹ Mới</h3>
          <p>Khởi tạo Smart Contract và ký quỹ AVAX an toàn</p>
        </div>

        {/* Hộp tóm tắt lỗi thả xuống ở đầu form */}
        <div className="u244-sm" role="alert" aria-live="polite">
          <div>
            <div className="u244-sb">
              <b>
                <i aria-hidden="true">!</i>
                <span>Còn {remainingErrorCount} mục cần kiểm tra lại</span>
              </b>
              <ul>
                {summaryKeys.map((key) => {
                  const cfg = FIELD_CONFIG.find((f) => f.key === key);
                  const isFixed = !currentInvalidKeys.includes(key);
                  return (
                    <li key={key} className={isFixed ? 'is-fixed' : ''}>
                      <button
                        type="button"
                        className="u244-lk"
                        onClick={() => scrollToField(key)}
                      >
                        {cfg?.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Danh sách các trường nhập liệu */}
        {FIELD_CONFIG.map((field) => {
          const val = values[field.key] ?? '';
          const isValid = field.validate(val);
          const isBad = tried && !isValid;
          const isGood = tried && isValid && val.trim().length > 0;
          const isShaking = Boolean(shakeMap[field.key]);
          const inputId = `${uid}-${field.key}`;
          const msgId = `${uid}-${field.key}-msg`;

          return (
            <div
              key={field.key}
              ref={(el) => (fieldRefs.current[field.key] = el)}
              className={[
                'u244-fd',
                field.unit ? 'has-unit' : '',
                isBad ? 'is-bad' : '',
                isGood ? 'is-good' : '',
                isShaking ? 'is-shake' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="u244-lb-row">
                <label htmlFor={inputId}>{field.label}</label>
                {field.badge && (
                  <span
                    className={`u244-badge ${
                      field.badgeType === 'neutral' ? 'is-neutral' : ''
                    }`}
                  >
                    {field.badge}
                  </span>
                )}
              </div>

              <div className="u244-bx">
                <input
                  ref={(el) => (inputRefs.current[field.key] = el)}
                  id={inputId}
                  type={field.type}
                  step={field.step}
                  value={val}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  aria-invalid={isBad}
                  aria-describedby={msgId}
                  className={`u244-in ${field.isMono ? 'is-mono' : ''}`}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
                <span className="u244-ok" aria-hidden="true" />
                {field.unit && (
                  <span
                    className={`u244-unit ${
                      field.unitVariant === 'avax' ? 'is-avax' : ''
                    }`}
                  >
                    {field.unit}
                  </span>
                )}
              </div>

              <div className="u244-ms">
                <div>
                  <span id={msgId}>{field.errorMsg}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Thông tin phân rã 30/70 */}
        <div className="u244-split">
          <div className="u244-split-row">
            <span>• Giai đoạn 1 (30% Xuất kho):</span>
            <strong>{stage1Avax} AVAX</strong>
          </div>
          <div className="u244-split-row">
            <span>• Giai đoạn 2 (70% Nhận hàng):</span>
            <strong>{stage2Avax} AVAX</strong>
          </div>
          <p className="u244-note">
            ℹ️ Tiền ký quỹ sẽ được khóa trong hợp đồng Escrow cho tới khi các bên kích hoạt chữ ký.
          </p>
        </div>

        {/* Nút Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`u244-go ${isDone ? 'is-done' : ''}`}
        >
          {isSubmitting
            ? '⏳ Đang gửi giao dịch lên Fuji...'
            : isDone
            ? '✓ Đã khởi tạo đơn hàng thành công'
            : '🔒 Tạo Đơn & Khóa AVAX'}
        </button>
      </form>
    </div>
  );
}