import pyautogui
import time

# Click the Print button to export to PDF
pyautogui.click(278, 260)  # Click Print button
time.sleep(2)
print("Clicked Print button to export PDF")