import { createClient } from "@/lib/supabase/server";
import { createProposal } from "@/app/proposals/actions";

export default async function NewProposalPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("tags").select("*").order("label"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">If you were mayor, you'd...</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Write it like real ordinance or project language where you can —
        others will be able to comment, suggest edits, and support it.
      </p>

      <form action={createProposal} className="mt-6 space-y-5">
        <Field label="Title">
          <input name="title" required className="input" />
        </Field>

        <Field label="Type">
          <select name="type" className="input" defaultValue="policy">
            <option value="policy">Policy</option>
            <option value="project">Project</option>
          </select>
        </Field>

        <Field label="Category">
          <select name="category_id" required className="input">
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.requires_budget ? "" : " (no direct budget line)"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tags (select any that apply)">
          <div className="flex flex-wrap gap-3 text-sm">
            {tags?.map((t) => (
              <label key={t.id} className="flex items-center gap-1">
                <input type="checkbox" name="tag_ids" value={t.id} />
                {t.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Geographic scope">
          <select name="geography_scope" className="input" defaultValue="citywide">
            <option value="citywide">Citywide</option>
            <option value="council_district">Council district</option>
            <option value="neighborhood">Neighborhood</option>
            <option value="zip">Zip code</option>
            <option value="address">Specific address / intersection</option>
          </select>
        </Field>

        <Field label="Where, specifically (e.g. '5th Council District', 'Fishtown', '19125', 'Frankford & Girard')">
          <input name="geography_label" className="input" />
        </Field>
        <p className="-mt-3 text-xs text-neutral-500">
          Dropping a pin or drawing an area on a map is planned for a follow-up
          version — for now, describe the location in words above.
        </p>

        <Field label="Summary (one or two sentences)">
          <textarea name="summary" required rows={2} className="input" />
        </Field>

        <Field label="Full proposal text">
          <textarea
            name="body"
            required
            rows={10}
            className="input font-mono text-sm"
            placeholder="Write it the way you'd want it to read as real ordinance or project language..."
          />
        </Field>

        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Post proposal
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
