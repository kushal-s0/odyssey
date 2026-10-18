"""Authored references for bounded component checks; not human-reviewed corpus labels."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    en = "I sell tea to office workers. A cup of tea costs 10 rupees."
    translations = [
        (
            "T01",
            "hi",
            "en",
            "मैं कार्यालय के कर्मचारियों को चाय बेचता हूँ। एक कप चाय की कीमत 10 रुपये है।",
            en,
            ["tea", "10"],
        ),
        (
            "T02",
            "hi",
            "en",
            "मेरी मासिक आय 10000 रुपये है और खर्च 18000 रुपये है। इसलिए व्यवसाय घाटे में है।",
            "My monthly income is 10000 rupees and expenses are 18000 rupees. Therefore the business is making a loss.",
            ["10000", "18000"],
        ),
        (
            "T03",
            "hi",
            "en",
            "किसी भी ग्राहक ने खरीदने के लिए सहमति नहीं दी है।",
            "None of the customers has agreed to buy.",
            ["__negation__"],
        ),
        (
            "T04",
            "hi",
            "en",
            "पहले जवाब में कीमत 10 रुपये है और दूसरे जवाब में कीमत 15 रुपये है।",
            "The price in the first answer is 10 rupees and in the second answer is 15 rupees.",
            ["10", "15"],
        ),
        (
            "T05",
            "hi",
            "en",
            "निवेश की राशि अभी तय नहीं है।",
            "The investment amount has not yet been decided.",
            ["__unknown__"],
        ),
        (
            "T06",
            "mr",
            "en",
            "मी कार्यालयातील कर्मचाऱ्यांना चहा विकतो. एका कप चहाची किंमत 10 रुपये आहे.",
            en,
            ["tea", "10"],
        ),
        (
            "T07",
            "te",
            "en",
            "నేను కార్యాలయ ఉద్యోగులకు టీ అమ్ముతాను. ఒక కప్పు టీ ధర 10 రూపాయలు.",
            en,
            ["tea", "10"],
        ),
        (
            "T08",
            "bn",
            "en",
            "আমি অফিসের কর্মীদের চা বিক্রি করি। এক কাপ চায়ের দাম 10 টাকা।",
            "I sell tea to office workers. A cup of tea costs 10 taka.",
            ["tea", "10"],
        ),
        (
            "T09",
            "or",
            "en",
            "ମୁଁ ଅଫିସ କର୍ମଚାରୀମାନଙ୍କୁ ଚା ବିକ୍ରି କରେ। ଗୋଟିଏ କପ୍ ଚାର ଦାମ 10 ଟଙ୍କା।",
            en,
            ["tea", "10"],
        ),
        (
            "T10",
            "en",
            "hi",
            "Revenue is not the same as profit. Monthly expenses are 18000 rupees.",
            "आय और लाभ एक जैसे नहीं हैं। मासिक खर्च 18000 रुपये है।",
            ["18000"],
        ),
    ]
    languages = [
        {"id": key, "expected_language": source, "text": text}
        for key, source, target, text, ref, terms in translations
        if source != "en"
    ]
    languages.extend(
        [
            {"id": "L10", "expected_language": "en", "text": en},
            {
                "id": "L11",
                "expected_language": "en",
                "text": "My monthly revenue is 10000 rupees and expenses are 18000 rupees. The business is losing money.",
            },
            {"id": "L12", "expected_language": "und", "text": "Tea"},
            {"id": "L13", "expected_language": "und", "text": "10"},
        ]
    )
    qa = [
        ("What will you sell?", "I will repair mobile phone screens.", 0),
        ("Who are your customers?", "Local school teachers.", 0),
        ("What is your selling price?", "INR 275 per repair.", 0),
        ("What are your monthly expenses?", "My monthly expenses are INR 18000.", 0),
        (
            "What is your expected monthly revenue?",
            "I expect INR 99999999 of monthly revenue.",
            0,
        ),
        ("Which materials do you need?", "Needles and thread.", 0),
        ("Where will you operate?", "A market stall in Jaipur.", 0),
        ("Who supplies your milk?", "The nearby dairy cooperative.", 0),
        ("What will you sell?", "I enjoyed the cricket final yesterday.", 1),
        ("What is your selling price?", "Customers are school teachers.", 1),
        ("Who are your customers?", "A sewing machine costs INR 18000.", 1),
        ("What are your monthly expenses?", "My shop name is Blue Moon Tailors.", 1),
        (
            "What is your expected monthly revenue?",
            "The tea supplier closes at six.",
            1,
        ),
        ("Which materials do you need?", "The village school cricket team won.", 1),
        ("Where will you operate?", "The price is INR 275 per repair.", 1),
        ("Who supplies your milk?", "My expected sales revenue is INR 20000.", 1),
    ]
    corpus = [
        ("R01", "Tea stall selling morning drinks to office commuters."),
        ("R02", "Ginger tea cart with pre-order pickup near a bus station."),
        ("R03", "Tailor providing blouse alterations and garment stitching."),
        ("R04", "Clothing repair shop for office uniforms and trouser alterations."),
        ("R05", "Mobile phone screen and battery repair service."),
        ("R06", "Smartphone repair kiosk doing charging-port replacements."),
        ("R07", "Dairy selling milk to village households."),
        ("R08", "Poultry farm supplying eggs and chickens."),
        ("R09", "Solar panel installation and maintenance for rooftops."),
        ("R10", "Manufacturer of reusable shopping bags."),
    ]
    queries = [
        (
            "Q01",
            "A tea kiosk for commuters needing hot drinks before work.",
            ["R01", "R02"],
        ),
        (
            "Q02",
            "Stitching and alteration service for customer garments.",
            ["R03", "R04"],
        ),
        (
            "Q03",
            "A shop replacing broken smartphone screens and batteries.",
            ["R05", "R06"],
        ),
        ("Q04", "Installing and maintaining solar power equipment on homes.", ["R09"]),
    ]
    ocr = [
        (
            "O01",
            "clean_print",
            "Business idea: Tea for office workers.\nPrice: INR 10 per cup.\nStartup investment: INR 20000.",
        ),
        (
            "O02",
            "numeric_loss",
            "Monthly revenue: INR 10000.\nMonthly expenses: INR 18000.\nOperating loss: INR 8000.\nProfit is not known.",
        ),
        (
            "O03",
            "rendered_script_font",
            "My customers are local office workers.\nI sell tea for INR 10 per cup.\nI need INR 20000 to start.",
        ),
    ]
    result = {
        "scope": "Small authored synthetic component references. Not independent human corpus evaluation. Script font is not real handwriting.",
        "translations": [
            {
                "id": i,
                "source_language": s,
                "target_language": t,
                "source": text,
                "reference": ref,
                "required_terms": terms,
            }
            for i, s, t, text, ref, terms in translations
        ],
        "languages": languages,
        "qa": [
            {"id": f"A{i:02}", "question": q, "answer": a, "gold": g}
            for i, (q, a, g) in enumerate(qa, 1)
        ],
        "retrieval_corpus": [{"id": i, "text": t} for i, t in corpus],
        "retrieval_queries": [
            {"id": i, "text": t, "relevant_ids": r} for i, t, r in queries
        ],
        "ocr": [{"id": i, "style": s, "reference": t} for i, s, t in ocr],
    }
    path = ROOT / "evals/benchmarks/comprehensive-component-cases.json"
    path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        "Frozen component references: translation10, language13, QA16, retrieval4x10, OCR3"
    )


if __name__ == "__main__":
    main()
