param([Parameter(Mandatory=$true)][string]$Manifest)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$sampleManifest = Get-Item -LiteralPath $Manifest
$sampleRecords = Get-Content -LiteralPath $sampleManifest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$sampleSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $sampleSynth.Rate = 0
    foreach ($sampleCase in $sampleRecords) {
        if ($sampleCase.id -notmatch '^[a-z0-9-]+$') { throw 'Invalid local sample identifier' }
        $sampleTarget = Join-Path $sampleManifest.DirectoryName ($sampleCase.id + '.wav')
        $sampleSynth.SetOutputToWaveFile($sampleTarget)
        $sampleSynth.Speak([string]$sampleCase.text)
        $sampleSynth.SetOutputToNull()
    }
} finally {
    $sampleSynth.Dispose()
}
