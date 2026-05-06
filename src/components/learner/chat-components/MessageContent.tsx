"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PromptTemplate } from "./PromptTemplate";
import { WorkflowSteps } from "./WorkflowSteps";
import { ToolSpotlight } from "./ToolSpotlight";
import { ComparisonTable } from "./ComparisonTable";
import { Checklist } from "./Checklist";
import { PromptIteration } from "./PromptIteration";
import { ResourceLink } from "./ResourceLink";
import { ActionCard } from "./ActionCard";
import { KnowledgeCheck } from "./KnowledgeCheck";
import { CodeSnippet } from "./CodeSnippet";
import { CourseCard } from "./CourseCard";

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  // Pattern to find our custom components: :::component_name {JSON_PROPS} :::
  // We use a more robust regex that handles potential whitespace and newlines better
  const parts = content.split(/(:::[a-z_]+[\s\S]*?:::)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.trim().startsWith(":::")) {
          try {
            // Updated regex to handle component names and props more accurately
            const match = part.match(/:::([a-z_]+)\s*([\s\S]*?)\s*:::/);
            if (!match) return null;

            const name = match[1];
            let propsStr = match[2].trim();
            
            // Clean up common AI formatting errors in JSON
            // Remove markdown code blocks if the AI wrapped JSON in them
            propsStr = propsStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
            
            const props = JSON.parse(propsStr.trim());

            switch (name) {
              case "prompt_template":
                return <PromptTemplate key={i} {...props} />;
              case "workflow_steps":
                return <WorkflowSteps key={i} {...props} />;
              case "tool_spotlight":
                return <ToolSpotlight key={i} {...props} />;
              case "comparison_table":
                return <ComparisonTable key={i} {...props} />;
              case "checklist":
                return <Checklist key={i} {...props} />;
              case "prompt_iteration":
                return <PromptIteration key={i} {...props} />;
              case "resource_link":
                return <ResourceLink key={i} {...props} />;
              case "action_card":
                return <ActionCard key={i} {...props} />;
              case "knowledge_check":
                return <KnowledgeCheck key={i} {...props} />;
              case "code_snippet":
                return <CodeSnippet key={i} {...props} />;
              case "course_card":
                return <CourseCard key={i} {...props} />;
              default:
                return <pre key={i} className="text-xs text-red-500">Unknown component: {name}</pre>;
            }
          } catch (e) {
            console.error("Failed to parse component props", e, part);
            return (
              <div key={i} className="my-2 rounded-xl border border-red-100 bg-red-50/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">Component Render Error</p>
                <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-600">{part}</pre>
              </div>
            );
          }
        }

        return (
          <ReactMarkdown 
            key={i}
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
              ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              h1: ({ children }) => <h1 className="mb-4 text-xl font-bold">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-3 text-lg font-bold">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 text-base font-bold">{children}</h3>,
              blockquote: ({ children }) => (
                <blockquote className="mb-4 border-l-4 border-blue-200 pl-4 italic text-slate-600">
                  {children}
                </blockquote>
              ),
              code: ({ node, inline, className, children, ...props }: any) => {
                if (inline) {
                  return (
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-blue-700" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <div className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner">
                    <pre className="font-mono text-xs leading-relaxed text-slate-800">
                      <code>{children}</code>
                    </pre>
                  </div>
                );
              }
            }}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
