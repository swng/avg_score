v2.3

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
    - alternatively, as of v2.3, sfinder_all_permutations() function exists as an option to generate queues.
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
Script should compute accurately on solution queues without dupes e.g. *p7 - for solution queues with dupes, comment out the error thrown on line 830.  
Solution queues with dupes have a large set of hold reorderings that may be annoying to compute with sfinder. By default the code ships with an error thrown when nohold cover data is incomplete. If it's too annoying to get sfinder compute the weird complete set, you can adjust the logic a little.  
As of v2.0, this script now features an SRS placeability checker. This *should* have no effect on the score evaluation of nodupe queue stuff except making computation take longer (remove the is_placeable() call on line 663 if you want to speed things up). For dupe queues, this should make computation more accurate.