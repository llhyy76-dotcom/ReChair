from __future__ import annotations

import sys
import traceback

from core.pdf_auto_approval import run_pdf_auto_approval


def main() -> int:
    try:
        result = run_pdf_auto_approval(".")
        print("=" * 60)
        print("PDF Auto Approval Result")
        print("=" * 60)
        print(f"Scanned          : {result.scanned_files}")
        print(f"Auto approved    : {result.auto_approved_files}")
        print(f"Manual review    : {result.review_required_files}")
        print(f"Errors           : {result.failed_files}")
        print(f"Decision log     : {result.decision_log}")
        print(f"Approval log     : {result.approval_log or ''}")
        print("=" * 60)
        for item in result.decisions:
            print(f"[{item.decision}] {item.review_file.name}")
            print(f"  {item.reason}")
        return 1 if result.failed_files else 0
    except Exception:
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
