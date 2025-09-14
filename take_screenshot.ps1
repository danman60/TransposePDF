Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Open browser to the application
Start-Process "http://localhost:8000/"

# Wait for browser to load
Start-Sleep 5

# Take screenshot
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
$bitmap.Save("D:\ClaudeCode\initial_screenshot.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Screenshot saved to D:\ClaudeCode\initial_screenshot.png"