import {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from 'react';

interface BufferedInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onCommit: (nextValue: string) => void;
  debounceMs?: number;
}

export function BufferedInput({
  value,
  onCommit,
  debounceMs = 120,
  onFocus,
  onBlur,
  ...rest
}: BufferedInputProps) {
  const [draft, setDraft] = useState<string>(value);
  const draftRef = useRef<string>(value);
  const valueRef = useRef<string>(value);
  const isFocusedRef = useRef<boolean>(false);
  const isDirtyRef = useRef<boolean>(false);
  const lastCommittedRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const onCommitRef = useRef(onCommit);

  onCommitRef.current = onCommit;
  valueRef.current = value;

  useEffect(() => {
    if (value === lastCommittedRef.current) {
      lastCommittedRef.current = null;
      return;
    }
    if (value === draftRef.current) {
      return;
    }
    if (isFocusedRef.current || isDirtyRef.current) {
      return;
    }
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  const flushNow = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isDirtyRef.current && draftRef.current === valueRef.current) {
      return;
    }
    isDirtyRef.current = false;
    const nextVal = draftRef.current;
    lastCommittedRef.current = nextVal;
    onCommitRef.current(nextVal);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (isDirtyRef.current) {
        isDirtyRef.current = false;
        onCommitRef.current(draftRef.current);
      }
    };
  }, []);

  return (
    <input
      {...rest}
      value={draft}
      onFocus={(e) => {
        isFocusedRef.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        flushNow();
        onBlur?.(e);
      }}
      onChange={(e) => {
        const nextVal = e.target.value;
        draftRef.current = nextVal;
        isDirtyRef.current = true;
        setDraft(nextVal);

        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          flushNow();
        }, debounceMs);
      }}
    />
  );
}

interface BufferedTextareaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'value' | 'onChange'
  > {
  value: string;
  onCommit: (nextValue: string) => void;
  debounceMs?: number;
}

export function BufferedTextarea({
  value,
  onCommit,
  debounceMs = 120,
  onFocus,
  onBlur,
  ...rest
}: BufferedTextareaProps) {
  const [draft, setDraft] = useState<string>(value);
  const draftRef = useRef<string>(value);
  const valueRef = useRef<string>(value);
  const isFocusedRef = useRef<boolean>(false);
  const isDirtyRef = useRef<boolean>(false);
  const lastCommittedRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const onCommitRef = useRef(onCommit);

  onCommitRef.current = onCommit;
  valueRef.current = value;

  useEffect(() => {
    if (value === lastCommittedRef.current) {
      lastCommittedRef.current = null;
      return;
    }
    if (value === draftRef.current) {
      return;
    }
    if (isFocusedRef.current || isDirtyRef.current) {
      return;
    }
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  const flushNow = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isDirtyRef.current && draftRef.current === valueRef.current) {
      return;
    }
    isDirtyRef.current = false;
    const nextVal = draftRef.current;
    lastCommittedRef.current = nextVal;
    onCommitRef.current(nextVal);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (isDirtyRef.current) {
        isDirtyRef.current = false;
        onCommitRef.current(draftRef.current);
      }
    };
  }, []);

  return (
    <textarea
      {...rest}
      value={draft}
      onFocus={(e) => {
        isFocusedRef.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        flushNow();
        onBlur?.(e);
      }}
      onChange={(e) => {
        const nextVal = e.target.value;
        draftRef.current = nextVal;
        isDirtyRef.current = true;
        setDraft(nextVal);

        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          flushNow();
        }, debounceMs);
      }}
    />
  );
}
