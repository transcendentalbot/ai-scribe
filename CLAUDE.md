## Communication  
After finishing a task or subtask, summarize what you did, what happened, and what's next. Then use the `say` command to read it out loud.

## Deployment Context
**IMPORTANT**: This project uses specific deployment methodologies:
- **Backend**: AWS CDK (TypeScript) - Deploy using `cd infrastructure-cdk && ./deploy.sh`
- **Frontend**: Vercel (Next.js) - Deploy using `cd frontend && vercel --prod`
- **Never mix methodologies**: Backend is ALWAYS CDK, Frontend is ALWAYS Vercel
- **Check DEPLOYMENT.md** for detailed deployment instructions