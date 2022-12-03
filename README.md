v1.8

Compute the average score of a DPC setup, given a solution set.  
Takes into account tspins, quads, line clears, combos.  
Doesn't currently take into account sd/hd points.

Usage:
Script can take either path.csv for a base field input or custom solution set cover.csv input.  
1) precompute nohold cover with sfinder (and remember to give it all possible hold reordered queues)
    - Example command for base field:
    - java -jar sfinder.jar path -d 180 -p *p7 -t [field fumen] --hold avoid -split yes -f csv -k pattern -o output/path.csv
    - Example command for custom solution set:
    - java -jar sfinder.jar cover -d 180 -p *p7 -t [fumen solutions] --hold avoid -o output/cover_nohold.csv
2) set parameters in the calculate_all_scores() function call
    - set the queues to run through - for *p7 it'll just be generate_all_permutations('TILJSZO')
    - cover data - loadPathCSV() for path.csv input and loadCSV for cover.csv input
    - base b2b
    - base combo
    - b2b end bonus
3) run script
    - node avg_score.js

Hopefully it should output an average score of the optimized solution for  each possible queue, along with other pertinent info.

Notes:  
This assumes the solutions are valid and the cover.csv files were generated correctly. There's very little error handling.  
There are a couple debugging console logs, comment them out if you wish.  
For non 100% setups, comment out the "PC fail queue" throw statement. This will give that queue -3000 points in the average.  
Script should compute accurately on solution queues without dupes e.g. *p7 - for solution queues with dupes, the code is set up to _try_, but the result may not be accurate, likely overscoring. This is due to information loss (queue string + solution no longer necessarily refers to exactly one sequence) and the lack of a **true** SRS placeability check in the code. By default the code should ship with errors that trigger on dupe piece queues. You may comment them out to get results but those results aren’t currently guaranteed to be accurate.  
Solution queues with dupes have a large set of hold reorderings that may be annoying to compute with sfinder. By default the code ships with an error thrown when nohold cover data is incomplete. If it's too annoying to get sfinder compute the weird complete set, you can adjust the logic a little. Again, without a true SRS placeability check, results aren't guaranteed to be accurate.