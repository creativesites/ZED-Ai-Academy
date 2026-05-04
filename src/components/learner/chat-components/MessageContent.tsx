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

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  // Pattern to find our custom components: :::component_name {JSON_PROPS} :::
  const parts = content.split(/(:::[a-z_]+[\s\S]*?:::)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith(":::")) {
          try {
            const match = part.match(/:::([a-z_]+)\s*([\s\S]*?)\s*:::/);
            if (!match) return null;

            const name = match[1];
            const propsStr = match[2];
            const props = JSON.parse(propsStr);

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
              default:
                return <pre key={i} className="text-xs text-red-500">Unknown component: {name}</pre>;
            }
          } catch (e) {
            console.error("Failed to parse component props", e);
            return <pre key={i} className="text-xs text-red-500">Error parsing component: {part}</pre>;
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
