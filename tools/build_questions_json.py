import re
import json
from pathlib import Path

SRC = Path("tools/merged.txt")
OUT = Path("data/questions.json")

# MODULE 1: BLOCKCHAIN BASICS
MODULE_RE = re.compile(r"^MODULE\s+(\d+)\s*:\s*(.+)$", re.IGNORECASE)

# Question 12 EASY
QHDR_RE = re.compile(r"^Question\s+(\d+)\s+(EASY|MEDIUM|HARD)\s*$", re.IGNORECASE)

# (a) text
ANS_RE = re.compile(r"^\((a|b|c|d)\)\s+(.*\S)\s*$", re.IGNORECASE)

# Correct Answer: c
CORR_RE = re.compile(r"^Correct\s+Answer\s*:\s*([a-d])\s*$", re.IGNORECASE)

def main():
    lines = SRC.read_text(encoding="utf-8", errors="ignore").splitlines()

    questions = []
    current_module = "Без модуля"

    cur = None

    def flush():
        nonlocal cur
        if not cur:
            return
        # проверка минимальной валидности
        if cur["question"] and len(cur["answers"]) >= 2 and any(a["correct"] for a in cur["answers"]):
            questions.append(cur)
        cur = None

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1

        if not line:
            continue

        # Игнорируем мусор типа "2" (номер страницы)
        if re.fullmatch(r"\d+", line):
            continue

        m_mod = MODULE_RE.match(line)
        if m_mod:
            flush()
            module_num = m_mod.group(1)
            module_name = m_mod.group(2).strip()
            current_module = f"MODULE {module_num}: {module_name}"
            continue

        m_q = QHDR_RE.match(line)
        if m_q:
            flush()
            qnum = int(m_q.group(1))
            diff = m_q.group(2).upper()

            # следующая НЕпустая строка — текст вопроса
            question_text = ""
            while i < len(lines):
                t = lines[i].strip()
                i += 1
                if not t:
                    continue
                # иногда там может быть номер страницы - пропускаем
                if re.fullmatch(r"\d+", t):
                    continue
                question_text = t
                break

            cur = {
                "id": qnum,
                "category": current_module,
                "difficulty": diff,
                "question": question_text,
                "answers": []
            }
            continue

        if cur:
            m_a = ANS_RE.match(line)
            if m_a:
                letter = m_a.group(1).lower()
                text = m_a.group(2).strip()
                cur["answers"].append({"letter": letter, "text": text, "correct": False})
                continue

            m_c = CORR_RE.match(line)
            if m_c:
                corr = m_c.group(1).lower()
                for a in cur["answers"]:
                    if a.get("letter") == corr:
                        a["correct"] = True
                continue

            # если строка не ответ и не correct-answer:
            # иногда вопрос может продолжаться на следующей строке до вариантов
            if len(cur["answers"]) == 0:
                cur["question"] += " " + line

    flush()

    # убрать letter, сайту не нужно
    for q in questions:
        for a in q["answers"]:
            a.pop("letter", None)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Saved: {OUT.resolve()}")
    print(f"Questions parsed: {len(questions)}")
    # простая проверка
    if questions:
        print("Example:", questions[0]["category"], questions[0]["difficulty"], questions[0]["question"])

if __name__ == "__main__":
    main()
