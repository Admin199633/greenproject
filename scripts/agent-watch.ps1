param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("architect","developer","tester")]
  [string]$Role
)

$BoardPath = "docs\AGENT_BOARD.md"
$SeenPath = ".agent-$Role-seen.txt"

Write-Host "[$Role] watcher started. Watching $BoardPath"

if (!(Test-Path $SeenPath)) {
  "" | Out-File $SeenPath
}

while ($true) {
  if (!(Test-Path $BoardPath)) {
    Start-Sleep -Seconds 2
    continue
  }

  $board = Get-Content $BoardPath -Raw
  $seen = Get-Content $SeenPath -Raw

  $pattern = "### (MSG-\d+) \| PO -> ([^\|]+) \| status: open([\s\S]*?)(?=### MSG-|\z)"
  $matches = [regex]::Matches($board, $pattern)

  foreach ($match in $matches) {
    $msgId = $match.Groups[1].Value
    $targets = $match.Groups[2].Value.ToLower()
    $body = $match.Groups[3].Value.Trim()

    if ($seen -match [regex]::Escape($msgId)) {
      continue
    }

    if (
      ($targets -notmatch $Role) -and
      ($targets -notmatch "all") -and
      ($targets -notmatch "team")
    ) {
      continue
    }

    $time = Get-Date -Format "HH:mm:ss"

    Write-Host "[$Role] new message detected: $msgId"

$prompt = @"
You are the $Role agent in a multi-terminal demo.

Respond ONLY to this PO message:

$body

Rules:
- Keep the response concise.
- If the PO asks for exactly one word, answer exactly one word.
- Do not explain unless the task requires it.

Role-specific permissions:
- architect:
  - read-only
  - do not edit product code
  - do not use Jira
  - do not use Playwright
- developer:
  - may edit code ONLY if the PO explicitly approved implementation
  - do not use Jira
  - do not use Playwright
- tester:
  - may run tests ONLY if the PO explicitly requested validation
  - may use Playwright MCP ONLY if the PO explicitly requested live browser validation
  - must open the real app URL when live browser validation is requested
  - do not edit product code
  - do not use Jira

Output:
- Output only the response text.
"@
    try {
      $response = claude -p $prompt --dangerously-skip-permissions --output-format text 2>&1
      $responseText = ($response | Out-String).Trim()

      Write-Host "[$Role] response to $msgId"
      Write-Host "[$time]"
      Write-Host $responseText
      Write-Host ""

      $boardMessage = @"

### RESPONSE to $msgId | $Role -> PO

$responseText
"@

      Add-Content $BoardPath $boardMessage
      Add-Content $SeenPath "$msgId`n"

    }
    catch {
      Write-Host "[$Role] ERROR processing $msgId"
      Write-Host $_
    }
  }

  Start-Sleep -Milliseconds 800
}