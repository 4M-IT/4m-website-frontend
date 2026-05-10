import { loadNewsArticles, loadNewsArticleById } from '@/services/news';
import type { NewsArticle } from '@/types/news';

export async function getAllNews(): Promise<NewsArticle[]> {
  try {
    return await loadNewsArticles();
  } catch (error) {
    console.error('Error loading news data:', error);
    return [];
  }
}

export async function getNewsById(id: string): Promise<NewsArticle | null> {
  try {
    return await loadNewsArticleById(id);
  } catch (error) {
    console.error('Error loading news article:', error);
    return null;
  }
}

export async function getFeaturedNews(): Promise<NewsArticle[]> {
  const allNews = await getAllNews();
  return allNews.filter((article) => article.featured);
}

export async function getNewsByCategory(category: string): Promise<NewsArticle[]> {
  const allNews = await getAllNews();
  return allNews.filter((article) => article.category.toLowerCase() === category.toLowerCase());
}

export async function getRelatedNews(currentId: string, category: string, limit: number = 3): Promise<NewsArticle[]> {
  const categoryNews = await getNewsByCategory(category);
  return categoryNews.filter((article) => article.id !== currentId).slice(0, limit);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString.replace(/\./g, '/'));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatContent(content: string): string {
  const escapeHtml = (value: string): string => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const renderInline = (value: string): string => escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  return content
    .split(/\n{2,}/)
    .map((block) => {
      const paragraph = block.trim();
      if (!paragraph) return '';
      if (paragraph.startsWith('### ')) {
        return `<h3 class="text-xl font-bold text-gray-900 mt-6 mb-3 font-fredoka">${renderInline(paragraph.replace('### ', ''))}</h3>`;
      }
      if (paragraph.startsWith('## ')) {
        return `<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4 font-fredoka">${renderInline(paragraph.replace('## ', ''))}</h2>`;
      }
      if (paragraph.startsWith('# ')) {
        return `<h1 class="text-3xl font-bold text-gray-900 mt-10 mb-5 font-fredoka">${renderInline(paragraph.replace('# ', ''))}</h1>`;
      }
      return `<p class="mb-6 leading-relaxed text-gray-700">${renderInline(paragraph).replace(/\n/g, '<br />')}</p>`;
    })
    .join('');
}

export async function getNewsCategories(): Promise<string[]> {
  const allNews = await getAllNews();
  const categories = [...new Set(allNews.map((article) => article.category))];
  return categories.sort();
}
