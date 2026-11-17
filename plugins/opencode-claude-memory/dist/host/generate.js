export function buildGeneratePrompt(input) {
    const sections = [input.system?.trim(), input.text];
    if (input.schema) {
        sections.push(`Respond with only a JSON object matching this JSON schema, without code fences or commentary:\n${JSON.stringify(input.schema)}`);
    }
    return sections.filter((section) => Boolean(section)).join("\n\n");
}
