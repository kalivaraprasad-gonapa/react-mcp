import { z } from "zod";

export const CreateReactAppSchema = z.object({
  name: z.string(),
  template: z.string().optional(),
  directory: z.string().optional(),
});

export const RunReactAppSchema = z.object({
  projectPath: z.string(),
});

export const RunCommandSchema = z.object({
  command: z.string(),
  directory: z.string().optional(),
});

export const GetProcessOutputSchema = z.object({
  processId: z.string(),
});

export const StopProcessSchema = z.object({
  processId: z.string(),
});

export const EditFileSchema = z.object({
  filePath: z.string(),
  content: z.string(),
});

export const ReadFileSchema = z.object({
  filePath: z.string(),
});

export const InstallPackageSchema = z.object({
  packageName: z.string(),
  directory: z.string().optional(),
  dev: z.boolean().optional(),
});
