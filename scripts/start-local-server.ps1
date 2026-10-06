param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ArenaServerJob {
 [StructLayout(LayoutKind.Sequential)] public struct Basic { public long ProcessTime, JobTime; public uint Flags; public UIntPtr Min, Max; public uint Count; public UIntPtr Affinity; public uint Priority, Scheduling; }
 [StructLayout(LayoutKind.Sequential)] public struct IO { public ulong ReadCount, WriteCount, OtherCount, ReadBytes, WriteBytes, OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] public struct Extended { public Basic Limits; public IO Counters; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref Extended info, uint length);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 public static IntPtr Create() { var job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(); var info=new Extended(); info.Limits.Flags=0x2000; if(!SetInformationJobObject(job,9,ref info,(uint)Marshal.SizeOf(info))) { CloseHandle(job); throw new System.ComponentModel.Win32Exception(); } return job; }
 public static void Attach(IntPtr job, IntPtr process) { if(!AssignProcessToJobObject(job,process))throw new System.ComponentModel.Win32Exception(); }
}
"@
$serverJob = [IntPtr]::Zero
$serverProcess = $null
$serverLock = $null
$ownsLock = $false
try {
 $serverJob = [ArenaServerJob]::Create()
 if ($ValidateOnly) { foreach ($scriptName in @('index-builds.cjs','serve.cjs')) { if (-not (Test-Path -LiteralPath (Join-Path $projectRoot ('scripts/' + $scriptName)))) { throw 'Server script path is invalid.' } }; $runtime = Join-Path $projectRoot 'tools/node/node.exe'; if (-not (Test-Path -LiteralPath $runtime)) { throw 'Bundled runtime is missing.' }; & $runtime --version; if ($LASTEXITCODE -ne 0) { throw 'Bundled runtime failed.' }; Write-Host 'Launcher paths, bundled runtime and job configuration validated.'; return }
 $serverLock = New-Object System.Threading.Mutex($false, 'Local\ArenaLocalServer4173')
 try { $ownsLock = $serverLock.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $ownsLock = $true }
 if (-not $ownsLock) { Write-Host 'The local server launcher is already running.'; Start-Sleep -Seconds 2; return }
 $nodePath = Join-Path $projectRoot 'tools/node/node.exe'
 if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Bundled Node runtime is missing. Copy the complete project folder, including tools/node.' }
 & $nodePath (Join-Path $projectRoot 'scripts/index-builds.cjs')
 if ($LASTEXITCODE -ne 0) { throw 'Build indexing failed.' }
 $startInfo = New-Object System.Diagnostics.ProcessStartInfo
 $startInfo.FileName = $nodePath
 $startInfo.Arguments = '"' + (Join-Path $projectRoot 'scripts/serve.cjs') + '"'
 $startInfo.WorkingDirectory = $projectRoot
 $startInfo.UseShellExecute = $false
 $serverProcess = [System.Diagnostics.Process]::Start($startInfo)
 [ArenaServerJob]::Attach($serverJob, $serverProcess.Handle)
 Write-Host 'Local server: http://127.0.0.1:4173/overlay.html'
 Write-Host 'Keep this window open. Closing it stops the server.'
 while (-not $serverProcess.WaitForExit(300)) { }
 if ($serverProcess.ExitCode -ne 0) { throw 'Server exited with an error. Port 4173 may already be in use.' }
} catch {
 Write-Host $_.Exception.Message -ForegroundColor Red
 if (-not $ValidateOnly) { Read-Host 'Press Enter to close' | Out-Null } else { throw }
} finally {
 if ($serverJob -ne [IntPtr]::Zero) { [ArenaServerJob]::CloseHandle($serverJob) | Out-Null }
 if ($serverProcess) { if (-not $serverProcess.HasExited) { $serverProcess.Kill() }; $serverProcess.Dispose() }
 if ($ownsLock) { $serverLock.ReleaseMutex() }
 if ($serverLock) { $serverLock.Dispose() }
}
