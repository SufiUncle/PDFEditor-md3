import styles from "./page.module.css";
import Link from "next/link";
import { FileDown, FilePlus, SplitSquareHorizontal, FileText, Image as ImageIcon, RotateCw } from "lucide-react";

export default function Home() {
  const tools = [
    {
      title: "Merge PDF",
      description: "Combine multiple PDFs into one unified document.",
      icon: <FilePlus className={styles.icon} />,
      link: "/merge",
      color: "var(--primary)"
    },
    {
      title: "Split PDF",
      description: "Extract pages or separate a PDF into multiple files.",
      icon: <SplitSquareHorizontal className={styles.icon} />,
      link: "/split",
      color: "#f59e0b"
    },
    {
      title: "Compress PDF",
      description: "Reduce the file size of your PDF without losing quality.",
      icon: <FileDown className={styles.icon} />,
      link: "/compress",
      color: "#10b981"
    },
    {
      title: "Edit PDF Text",
      description: "Add, modify, or delete text directly in your PDF.",
      icon: <FileText className={styles.icon} />,
      link: "/edit",
      color: "#8b5cf6"
    },
    {
      title: "Images to PDF",
      description: "Convert JPG, PNG, and other images to a PDF document.",
      icon: <ImageIcon className={styles.icon} />,
      link: "/images-to-pdf",
      color: "#ec4899"
    },
    {
      title: "Rotate PDF",
      description: "Rotate one or all pages in your PDF document.",
      icon: <RotateCw className={styles.icon} />,
      link: "/rotate",
      color: "#3b82f6"
    }
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <FileText size={24} color="white" />
          </div>
          <h1>PDF Editor</h1>
        </div>
        <nav className={styles.nav}>
          <Link href="/merge">Merge</Link>
          <Link href="/split">Split</Link>
          <Link href="/compress">Compress</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Every tool you need to work with PDFs in one place
          </h1>
          <p className={styles.heroSubtitle}>
            All are 100% FREE and easy to use! Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks.
          </p>
          <div className={styles.heroButtons}>
            <Link href="/edit" className={`${styles.button} ${styles.primaryButton}`}>
              Start Editing
            </Link>
            <Link href="#tools" className={`${styles.button} ${styles.secondaryButton}`}>
              View All Tools
            </Link>
          </div>
        </section>

        <section id="tools" className={styles.toolsSection}>
          <div className={styles.toolsGrid}>
            {tools.map((tool, index) => (
              <Link href={tool.link} key={index} className={styles.toolCard}>
                <div className={styles.iconWrapper} style={{ backgroundColor: `${tool.color}15`, color: tool.color }}>
                  {tool.icon}
                </div>
                <div className={styles.toolContent}>
                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      
      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} PDF Editor. Built by MD3 Verse.</p>
      </footer>
    </div>
  );
}
