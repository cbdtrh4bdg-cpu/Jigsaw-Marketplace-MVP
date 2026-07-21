import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export type SignupInput = z.infer<typeof signupSchema>;
