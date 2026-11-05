Option Explicit

Dim shell, fileSystem, scriptDirectory, serverScript, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
serverScript = fileSystem.BuildPath(scriptDirectory, "serve-frontend.js")
command = """node.exe"" """ & serverScript & """"

shell.Run command, 0, False
