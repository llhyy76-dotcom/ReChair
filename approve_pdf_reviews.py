from __future__ import annotations

import sys
import traceback

from core.pdf_approval import process_approved_pdf_reviews


def main() -> int:
    try:
        result = process_approved_pdf_reviews(".")
        print("=" * 55)
        print("PDF 검토 승인 반영 결과")
        print("=" * 55)
        print(f"검토파일 : {result.scanned_files}")
        print(f"승인반영 : {result.approved_files}")
        print(f"승인대기 : {result.waiting_files}")
        print(f"실패     : {result.failed_files}")
        print(f"반영행   : {result.total_rows}")
        print(f"신규     : {result.total_new_parts}")
        print(f"보정     : {result.total_updated_rows}")
        print(f"가격변동 : {result.total_price_changes}")
        print(f"로그     : {result.log_path}")
        print("=" * 55)

        for item in result.files:
            print(f"[{item.status}] {item.review_file.name}")
            for error in item.errors:
                print(f"  - {error}")

        return 1 if result.failed_files else 0
    except Exception:
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
