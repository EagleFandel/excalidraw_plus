import { Injectable } from "@nestjs/common";

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();

  incrementCounter(name: string, labels?: Record<string, string | number>) {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  renderPrometheusText() {
    const lines = ["# TYPE excplus_requests_total counter"];

    for (const [key, value] of this.counters.entries()) {
      lines.push(`${key} ${value}`);
    }

    return `${lines.join("\n")}\n`;
  }

  private makeKey(name: string, labels?: Record<string, string | number>) {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelPairs = Object.entries(labels)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
      .join(",");

    return `${name}{${labelPairs}}`;
  }
}
