import sys
import multiprocessing as mp

from PySide6.QtWidgets import QApplication

from gui.main_window import MainWindow


def main() -> int:
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    mp.freeze_support()
    raise SystemExit(main())
