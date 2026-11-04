# Fixed test-only Win32 reader. No process enumeration or shell-derived commands.
# Source method: GetProcessTimes, creation/kernel/user from the same owned-PID handle.
param(
    [Parameter(Mandatory = $true)]
    [string] $InputPath
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Test-BoundedText([object] $Value, [int] $Maximum) {
    return ($Value -is [string] -and $Value.Length -gt 0 -and $Value.Length -le $Maximum -and
        $Value.Trim().Length -gt 0 -and $Value -notmatch '[\x00-\x1f\x7f]')
}

try {
    if (-not [IO.Path]::IsPathRooted($InputPath) -or $InputPath.Contains([char]0)) {
        throw 'ABSOLUTE_INPUT_PATH_REQUIRED'
    }
    # Open the bounded request without sharing write/delete access. Never enumerate.
    $stream = [IO.File]::Open($InputPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        if ($stream.Length -lt 1 -or $stream.Length -gt 262144) { throw 'REQUEST_BYTE_CAP' }
        $bytes = New-Object byte[] ([int] $stream.Length)
        $offset = 0
        while ($offset -lt $bytes.Length) {
            $read = $stream.Read($bytes, $offset, $bytes.Length - $offset)
            if ($read -le 0) { throw 'TRUNCATED_REQUEST' }
            $offset += $read
        }
        if ($stream.ReadByte() -ne -1) { throw 'REQUEST_CHANGED_DURING_READ' }
    }
    finally { $stream.Dispose() }
    $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $request = ConvertFrom-Json -InputObject ($utf8.GetString($bytes))
    if ($null -eq $request -or $request -is [array] -or
        ($request.schemaVersion -isnot [int] -and $request.schemaVersion -isnot [long]) -or $request.schemaVersion -ne 1 -or
        $request.method -cne 'WIN32_GET_PROCESS_TIMES_V4' -or
        $request.requestId -isnot [string] -or $request.requestId -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' -or
        $request.boundary -cnotin @('before', 'after') -or
        -not (Test-BoundedText $request.scope 256) -or $request.processes -isnot [array] -or
        $request.processes.Count -lt 1 -or $request.processes.Count -gt 1024) {
        throw 'INVALID_REQUEST_SCHEMA_OR_CAP'
    }
    $seen = New-Object 'System.Collections.Generic.HashSet[uint32]'
    foreach ($entry in $request.processes) {
        if ($null -eq $entry -or $entry -is [array] -or $entry.id -isnot [ValueType] -or
            $entry.id -is [bool] -or [double]::IsNaN([double] $entry.id) -or
            [double]::IsInfinity([double] $entry.id) -or [double] $entry.id -le 0 -or
            [double] $entry.id -gt 4294967295 -or [Math]::Truncate([double] $entry.id) -ne [double] $entry.id -or
            -not (Test-BoundedText $entry.type 128)) {
            throw 'INVALID_OWNED_PID_OR_TYPE'
        }
        if (-not $seen.Add([uint32] $entry.id)) { throw 'DUPLICATE_OWNED_PID' }
    }

    $nativeSource = @'
using System;
using System.Globalization;
using System.Runtime.InteropServices;

public static class ReflectionLabOwnedProcessTimesV4
{
    [StructLayout(LayoutKind.Sequential)]
    public struct FileTime
    {
        public uint Low;
        public uint High;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inheritHandle, uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetProcessTimes(IntPtr process, out FileTime creation, out FileTime exit, out FileTime kernel, out FileTime user);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr handle);

    public static string DecimalTicks(FileTime time)
    {
        return (((ulong)time.High << 32) | time.Low).ToString(CultureInfo.InvariantCulture);
    }
}
'@
    Add-Type -TypeDefinition $nativeSource -Language CSharp -ErrorAction Stop | Out-Null
    $rows = New-Object 'System.Collections.Generic.List[object]'
    foreach ($entry in $request.processes) {
        $row = [ordered] @{
            id = [uint32] $entry.id
            type = [string] $entry.type
            openSucceeded = $false
            querySucceeded = $null
            closeSucceeded = $null
            openErrorCode = $null
            queryErrorCode = $null
            closeErrorCode = $null
            creationTimeFileTimeTicks = $null
            kernelTimeTicks = $null
            userTimeTicks = $null
        }
        # PROCESS_QUERY_LIMITED_INFORMATION, no handle inheritance; exact input PID only.
        $handle = [ReflectionLabOwnedProcessTimesV4]::OpenProcess([uint32] 0x1000, $false, [uint32] $entry.id)
        if ($handle -eq [IntPtr]::Zero) {
            $row.openErrorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        }
        else {
            $row.openSucceeded = $true
            try {
                $creation = New-Object ReflectionLabOwnedProcessTimesV4+FileTime
                $exit = New-Object ReflectionLabOwnedProcessTimesV4+FileTime
                $kernel = New-Object ReflectionLabOwnedProcessTimesV4+FileTime
                $user = New-Object ReflectionLabOwnedProcessTimesV4+FileTime
                $queried = [ReflectionLabOwnedProcessTimesV4]::GetProcessTimes($handle, [ref] $creation, [ref] $exit, [ref] $kernel, [ref] $user)
                if (-not $queried) {
                    $row.queryErrorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                    $row.querySucceeded = $false
                }
                else {
                    # A successful counter zero is valid. Never infer validity from magnitude.
                    $row.querySucceeded = $true
                    $row.creationTimeFileTimeTicks = [ReflectionLabOwnedProcessTimesV4]::DecimalTicks($creation)
                    $row.kernelTimeTicks = [ReflectionLabOwnedProcessTimesV4]::DecimalTicks($kernel)
                    $row.userTimeTicks = [ReflectionLabOwnedProcessTimesV4]::DecimalTicks($user)
                }
            }
            finally {
                # A real successful-open handle is closed once even if querying throws.
                $closed = [ReflectionLabOwnedProcessTimesV4]::CloseHandle($handle)
                if (-not $closed) {
                    $row.closeErrorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                    $row.closeSucceeded = $false
                }
                else { $row.closeSucceeded = $true }
            }
        }
        $rows.Add([pscustomobject] $row)
    }
    $reply = [ordered] @{
        schemaVersion = 1
        method = 'WIN32_GET_PROCESS_TIMES_V4'
        requestId = [string] $request.requestId
        processes = @($rows.ToArray())
    }
    $json = ConvertTo-Json -InputObject $reply -Compress -Depth 6
    if ([Text.Encoding]::UTF8.GetByteCount($json) -gt 1048576) { throw 'REPLY_BYTE_CAP' }
    [Console]::Out.WriteLine($json)
    exit 0
}
catch {
    # A failure remains a nonzero exit and bounded stderr, never a fabricated zero DTO.
    $message = [string] $_.Exception.Message
    if ($message.Length -gt 512) { $message = $message.Substring(0, 512) }
    [Console]::Error.WriteLine($message)
    exit 1
}
